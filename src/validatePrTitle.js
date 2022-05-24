const conventionalCommitsConfig = require('conventional-changelog-conventionalcommits');
const conventionalCommitTypes = require('conventional-commit-types');
const parser = require('conventional-commits-parser').sync;
const formatMessage = require('./formatMessage');

const defaultTypes = Object.keys(conventionalCommitTypes.types);

module.exports = async function validatePrTitle(
  prTitle,
  {types, scopes, requireScope, subjectPattern, subjectPatternError} = {}
) {
  if (!types) types = defaultTypes;

  const {parserOpts} = await conventionalCommitsConfig();
  const result = parser(prTitle, parserOpts);

  function isUnknownScope(s) {
    return scopes && !scopes.includes(s);
  }

  if (!result.type) {
    throw new Error(
      `No PR type found in the title "${prTitle}". Format the PR title according to the Conventional Commits convention.\n\n  For example, set the PR title similar to *"**fix**: fixed the bug 123"*\n\n`
    );
  }

  if (!result.subject) {
    throw new Error(`No subject found in pull request title "${prTitle}".`);
  }

  if (!types.includes(result.type)) {
    throw new Error(
      `Unknown release type "${result.type}" found in pull request title "${prTitle}".`
    );
  }

  if (requireScope && !result.scope) {
    let msg = `No scope found in pull request title "${prTitle}".`;
    if (scopes) {
      msg += ` Use one of the available scopes: ${scopes.join(', ')}.`;
    }

    throw new Error(msg);
  }

  const givenScopes = result.scope
    ? result.scope.split(',').map((scope) => scope.trim())
    : undefined;
  const unknownScopes = givenScopes ? givenScopes.filter(isUnknownScope) : [];
  if (scopes && unknownScopes.length > 0) {
    throw new Error(
      `Unknown ${
        unknownScopes.length > 1 ? 'scopes' : 'scope'
      } "${unknownScopes.join(
        ','
      )}" found in pull request title "${prTitle}". Use one of the available scopes: ${scopes.join(
        ', '
      )}.`
    );
  }

  function throwSubjectPatternError(message) {
    if (subjectPatternError) {
      message = formatMessage(subjectPatternError, {
        subject: result.subject,
        title: prTitle
      });
    }

    throw new Error(message);
  }

  if (subjectPattern) {
    const match = result.subject.match(new RegExp(subjectPattern));

    if (!match) {
      throwSubjectPatternError(
        `The subject "${result.subject}" found in pull request title "${prTitle}" doesn't match the configured pattern "${subjectPattern}".`
      );
    }

    const matchedPart = match[0];
    if (matchedPart.length !== result.subject.length) {
      throwSubjectPatternError(
        `The subject "${result.subject}" found in pull request title "${prTitle}" isn't an exact match for the configured pattern "${subjectPattern}". Please provide a subject that matches the whole pattern exactly.`
      );
    }
  }
};
