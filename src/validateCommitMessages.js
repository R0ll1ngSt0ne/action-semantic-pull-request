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
const {promisify} = require('util');
const core = require('@actions/core');
const github = require('@actions/github');
const conventionalPresetConfig = require('@oat-sa/conventional-changelog-tao');
const presetBumper = require('@oat-sa/conventional-changelog-tao/bumper.js');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const gitSemverTags = require('git-semver-tags');
const semverInc = require('semver/functions/inc');
const semverParse = require('semver/functions/parse');
const parseConfig = require('./parseConfig');

//PR stops listing commits after this limit
const commitNumbersThreshold = 250;

/**
 * The main entry point
 * @return {Promise}
 */
module.exports = async function validateCommitMessages() {
  const {githubBaseUrl} = parseConfig();

  const context = github.context;
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN, {
    baseUrl: githubBaseUrl
  });

  const commitNumbers = context.payload.pull_request.commits;

  const pullCommits = await octokit.paginate(octokit.pulls.listCommits, {
    repo: context.repo.repo,
    owner: context.repo.owner,
    pull_number: context.payload.pull_request.number,
    per_page: 100
  });

  const includeCommits = pullCommits.map((commit) => commit.sha);

  const recommendation = await promisify(conventionalRecommendedBump)({
    //the preset cannot be used from string in an action due to missing lookups in node_modules
    config: conventionalPresetConfig,
    whatBump(commits) {
      return presetBumper().whatBump(
        commits.filter(
          (commit) =>
            includeCommits.includes(commit.hash) ||
            commit.body === '4621fd21-37a6-4dd0-b3f5-a71c28bc2b01'
        )
      );
    }
  });

  if (!recommendation) {
    throw new Error('Unable to retrieve commit information');
  }

  const tags = await promisify(gitSemverTags)();
  const version_altering_commits =
    recommendation.stats.breakings +
    recommendation.stats.features +
    recommendation.stats.fixes;

  let lastVersion;
  let version = '1.0.0';
  if (tags && tags.length > 0) {
    const lastTag = tags[0];
    if (lastTag) {
      const lastVersionObject = semverParse(lastTag);
      lastVersion = lastVersionObject.version;
      if (version_altering_commits > 0) {
        version = semverInc(lastVersion, recommendation.releaseType);
      } else {
        version = lastVersion;
      }
    }
  }

  core.setOutput('version', version);

  core.info(JSON.stringify(recommendation, null, ' '));

  if (
    recommendation.stats &&
    recommendation.stats.commits > 0 &&
    recommendation.stats.unset + recommendation.stats.merge >=
      recommendation.stats.commits
  ) {
    return [
      false,
      `No commit messages compliant with the convention were found. Add at least one such commit.\n\n  For example, push a commit with a message similar to: *"**feat**: added feature 345"*\n\n`
    ];
  }

  return [
    true,
    getMessage(recommendation, lastVersion, version, commitNumbers)
  ];
};

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
  const message = [];
  if (commitNumbers > commitNumbersThreshold) {
    message.push(
      `⚠️The pull request contains ${commitNumbers} commits. This message is based only on the first ${commitNumbersThreshold}.`
    );
  }
  if (level === 0) {
    message.push(
      '🚨 Your pull request contains a BREAKING CHANGE, please be sure to communicate it.'
    );
  }
  if (stats.unset > 0) {
    message.push(
      `ℹ Some commits are not following the convention. They will be ignored in the version management.`
    );
  }

  if (message.length === 0) {
    message.push(`✔ All commits are following the convention.`);
  }

  message.push(
    `🚀 Release target: ${lastVersion} 🡢 ${version} &nbsp;&nbsp;(*${reason.replace(
      'There are ',
      ''
    )}*)`
  );
  return message.join('\n');
}
