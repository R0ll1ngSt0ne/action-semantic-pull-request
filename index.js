const core = require('@actions/core');
const validateCommitMessages = require('./src/validateCommitMessages');
const validatePrTitleOrSingleCommit = require('./src/validatePrTitleOrSingleCommit');

let validationErrorPrTitleOrSingleCommit;
let validationErrorCommitMessages;

async function run() {
  try {
    await validatePrTitleOrSingleCommit();
  } catch (e) {
    validationErrorPrTitleOrSingleCommit = e;
  }

  try {
    await validateCommitMessages();
  } catch (e) {
    validationErrorCommitMessages = e;
  }

  if (validationErrorPrTitleOrSingleCommit && validationErrorCommitMessages) {
    core.setFailed(
      validationErrorPrTitleOrSingleCommit.message +
        ' / ' +
        validationErrorCommitMessages.message
    );
  }
}

run();
