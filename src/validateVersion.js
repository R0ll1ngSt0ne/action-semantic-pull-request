const {promisify} = require('util');
const core = require('@actions/core');
const gitSemverTags = require('git-semver-tags');
const semverInc = require('semver/functions/inc');
const semverParse = require('semver/functions/parse');
const getRecommendation = require('./getRecommendation');

module.exports = async function validateVersion() {
  const [, recommendation] = await getRecommendation(true);

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

  let message = `🚀 Release target: ${lastVersion} 🡢 ${version} &nbsp;&nbsp;(*${recommendation.reason.replace(
    'There are ',
    ''
  )}*)`;

  if (lastVersion === version) {
    message +=
      '\n* ⚠ No *important* changes were declared - the version will not change and release will not be triggered.\n\n  To address this, declare some "**feat**", "**fix**" or **BREAKING** changes';
  }

  return [true, message];
};
