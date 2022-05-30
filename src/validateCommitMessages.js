/*eslint no-undef: 0*/
const core = require('@actions/core');
const getRecommendation = require('./getRecommendation');

//PR stops listing commits after this limit
const commitNumbersThreshold = 250;

module.exports = async function validateCommitMessages() {
  [commitNumbers, recommendation] = await getRecommendation(false);

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

  return [true, getMessage(recommendation, commitNumbers)];
};

/**
 * Build the comment message
 * @param {Object} recommendation
 * @param {Object} recommendation.stats
 * @param {Number} recommendation.level
 * @param {Number} [commitNumbers=0]
 * @return {String} the message, in markdown format
 */
function getMessage({stats, level} = {}, commitNumbers = 0) {
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

  return message.join('\n');
}
