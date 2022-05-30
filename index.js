const core = require('@actions/core');
const github = require('@actions/github');
const conventionalCommitTypes = require('conventional-commit-types');
const parseConfig = require('./src/parseConfig');
const postComment = require('./src/postComment');
const validateCommitMessages = require('./src/validateCommitMessages');
const validatePrTitleOrSingleCommit = require('./src/validatePrTitleOrSingleCommit');

function conventionalCommitSummary(types) {
  const defaultTypes = Object.keys(conventionalCommitTypes.types);
  if (!types) types = defaultTypes;
  let summary = '---\n\n';
  const types_table = types
    .map((type) => {
      let bullet = `  | ${type}`;

      if (types === defaultTypes) {
        bullet += `  | ${conventionalCommitTypes.types[type].description}  |`;
      }

      return bullet;
    })
    .join('\n');
  summary += `<details>
  <summary>More information on the <i>Conventional Commits</i> convention:</summary>
  &nbsp;\n\n
  The commit message should be structured as follows:

  \`\`\`
  <type>[optional scope]: <description>
  
  [optional body]
  
  [optional footer(s)]
  \`\`\`  
    
  The available commit types are:
  | Type | Description |\n| --- | --- |\n${types_table}
  
  To indicate that the change is *BREAKING* (i.e. changes API contracts for example), add "**!**" after the type.
  
  For example: *"**feat!**: added some new parameters to API that break existing unit tests"*
  
  Please refer to [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) for more information.
</details>`;

  return summary;
}

async function run() {
  const commentHeader = '<!--ASPR-CM-f8854b54-0e83-4d76-af47-eef3cc47024d-->';

  let validate_pr_title_success, validate_pr_title_message;
  try {
    [validate_pr_title_success, validate_pr_title_message] =
      await validatePrTitleOrSingleCommit();
  } catch (e) {
    core.setFailed(e.message);
  }

  let validate_commits_success, validate_commits_message;
  try {
    [validate_commits_success, validate_commits_message] =
      await validateCommitMessages();
  } catch (e) {
    core.setFailed(e.message);
  }

  const {types, githubBaseUrl} = parseConfig();

  const context = github.context;
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN, {
    baseUrl: githubBaseUrl
  });

  let comment;
  if (!validate_pr_title_success && !validate_commits_success) {
    // validate_pr_title_message = '❌ ' + validate_pr_title_message;
    // validate_commits_message = '❌ ' + validate_commits_message;
    comment =
      '❌  *Conventional Commit* information is missing. Please resolve *either* of the following issues:\n';
  } else if (!validate_pr_title_success) {
    comment =
      '✔ *Conventional Commit* information was found in the commits, but not in PR title. Merge via *"Create a merge Commit"* mode only.';
    validate_pr_title_message = '⚠ ' + validate_pr_title_message;
  } else if (!validate_commits_success) {
    comment =
      '⚠ *Conventional Commit* information was found in the PR title, but not the commits. Merge via *"Squash and merge"* mode only.';
    validate_commits_message = '⚠ ' + validate_commits_message;
  } else {
    comment =
      '✔ *Conventional Commit* information was found in both the PR title *and* the commits. The merge can proceed using any method.';
  }

  comment +=
    '\n\n* ' +
    validate_pr_title_message +
    '\n* ' +
    validate_commits_message +
    '\n\n' +
    conventionalCommitSummary(types);

  await postComment(octokit, context, commentHeader, comment);

  if (!validate_pr_title_success && !validate_commits_success) {
    core.setFailed(
      validate_pr_title_message + '\n\n' + validate_commits_message
    );
  }
}

run();
