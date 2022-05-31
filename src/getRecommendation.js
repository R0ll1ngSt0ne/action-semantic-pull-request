const {promisify} = require('util');
const github = require('@actions/github');
const conventionalPresetConfig = require('@oat-sa/conventional-changelog-tao');
const presetBumper = require('@oat-sa/conventional-changelog-tao/bumper');
const conventionalCommitTypes = require('conventional-commit-types');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const parseConfig = require('./parseConfig');

module.exports = async function getRecommendation(includeTempCommit) {
  // eslint-disable-next-line prefer-const
  let {types, githubBaseUrl} = parseConfig();

  const defaultTypes = Object.keys(conventionalCommitTypes.types);
  if (!types) types = defaultTypes;

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
      const commits_copy = [];
      for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        if (commit.type && !types.includes(commit.type)) {
          commit.type = null;
        }
        commits_copy[i] = commit;
      }

      return presetBumper().whatBump(
        commits_copy.filter(
          (commit) =>
            includeCommits.includes(commit.hash) ||
            (includeTempCommit &&
              commit.body === '4621fd21-37a6-4dd0-b3f5-a71c28bc2b01')
        )
      );
    }
  });

  if (!recommendation) {
    throw new Error('Unable to retrieve commit information');
  }

  return [commitNumbers, recommendation];
};
