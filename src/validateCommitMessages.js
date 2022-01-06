/*eslint no-undef: 0*/
/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Copyright (c) 2020 (original work) Open Assessment Technologies SA ;
 */
const core = require('@actions/core');
const github = require('@actions/github');
const conventionalPresetConfig = require('@oat-sa/conventional-changelog-tao');
const presetBumper = require('@oat-sa/conventional-changelog-tao/bumper.js');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const gitSemverTags = require('git-semver-tags');
const semverInc = require('semver/functions/inc');
const semverParse = require('semver/functions/parse');
const parseConfig = require('./parseConfig');
const postComment = require('./postComment');

//PR stops listing commits after this limit
const commitNumbersThreshold = 250;

/**
 * The main entry point
 * @return {Promise}
 */
module.exports = function validateCommitMessages() {
  const {githubBaseUrl} = parseConfig();
  const commentHeader = '<!--ASPR-CM-f8854b54-0e83-4d76-af47-eef3cc47024d-->';

  const context = github.context;
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN, {
    baseUrl: githubBaseUrl
  });

  const commitNumbers = context.payload.pull_request.commits;

  return octokit
    .paginate(octokit.pulls.listCommits, {
      repo: context.repo.repo,
      owner: context.repo.owner,
      pull_number: context.payload.pull_request.number,
      per_page: 100
    })
    .then((commits) =>
      Promise.all([
        getRecommendation(commits.map((commit) => commit.sha)),
        getLastTag()
      ])
    )
    .then(([recommendation, lastTag] = []) => {
      if (!recommendation || !lastTag) {
        throw new Error('Unable to retrieve commits and tag information');
      }

      let lastVersion;
      let version;
      if (lastTag && recommendation) {
        const lastVersionObject = semverParse(lastTag);
        lastVersion = lastVersionObject.version;
        version = semverInc(lastVersionObject, recommendation.releaseType);
        core.setOutput('version', version);
      }

      core.info(JSON.stringify(recommendation, null, ' '));

      if (
        recommendation.stats &&
        recommendation.stats.commits > 0 &&
        recommendation.stats.unset + recommendation.stats.merge >=
          recommendation.stats.commits
      ) {
        return postComment(
          octokit,
          context,
          commentHeader,
          '❌ There are no commits messages compliant with the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) format!'
        ).then(() =>
          Promise.reject(
            new Error(
              'No commit messages compliant with conventional commits found'
            )
          )
        );
      }

      return postComment(
        octokit,
        context,
        commentHeader,
        getMessage(recommendation, lastVersion, version, commitNumbers)
      );
    });
};

/**
 * Get commit recommendation.
 * @param {Array} includeCommits The list of commits to include
 * @return {Promise<Object>} resolves with the recommendation object
 */
function getRecommendation(includeCommits) {
  return new Promise((resolve, reject) => {
    conventionalRecommendedBump(
      {
        //the preset cannot be used from string in an action due to missing lookups in node_modules
        config: conventionalPresetConfig,
        whatBump(commits) {
          return presetBumper().whatBump(
            commits.filter((commit) => includeCommits.includes(commit.hash))
          );
        }
      },
      (err, recommendation) => {
        if (err) {
          return reject(err);
        }

        resolve(recommendation);
      }
    );
  });
}

/**
 * Get the last tag,
 * it expects the local git to have the tags fetched
 * @return {Promise<Object>} resolves with the tag version object
 */
function getLastTag() {
  return new Promise((resolve, reject) => {
    gitSemverTags((err, tags) => {
      if (err) {
        return reject(err);
      }
      if (tags && tags.length > 0) {
        return resolve(tags[0]);
      }
      return reject(new Error('no tag found'));
    });
  });
}

/**
 * Build the comment message
 * @param {Object} recommendation
 * @param {Object} recommendation.stats
 * @param {Number} recommendation.level
 * @param {String} recommendation.reason
 * @param {String} lastVersion
 * @param {String} version
 * @param {Number} [commitNumbers=0]
 * @return {String} the message, in markdown format
 */
function getMessage(
  {stats, level, reason} = {},
  lastVersion,
  version,
  commitNumbers = 0
) {
  const message = ['### Version'];
  if (commitNumbers > commitNumbersThreshold) {
    message.push(
      `⚠️  The pull request contains ${commitNumbers} commits. This message is based only on the first ${commitNumbersThreshold}.`
    );
  }
  if (level === 0) {
    message.push(
      '🚨 Your pull request contains a BREAKING CHANGE, please be sure to communicate it.'
    );
  }
  if (stats.unset > 0) {
    message.push(
      `❕ Some commits are not using the conventional commits formats. They will be ignored in version management.`
    );
  }
  message.push(`
| Target Version | ${version} |
| -------------- | ---------- |
| Last version   | ${lastVersion} |
    `);
  message.push(`${reason}`);
  return message.join('\n');
}
