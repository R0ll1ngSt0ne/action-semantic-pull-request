const core = require('@actions/core');

const validatePrTitleOrSingleCommit = require('./src/validatePrTitleOrSingleCommit');
const validateCommitMessages = require('./src/validateCommitMessages');

let validationErrorPrTitleOrSingleCommit;
let validationErrorCommitMessages;

try {
    await validatePrTitleOrSingleCommit()
} catch (e) {
    validationErrorPrTitleOrSingleCommit = error;
}

try {
    await validateCommitMessages()
} catch (e) {
    validationErrorCommitMessages = error;
}

if (validationErrorPrTitleOrSingleCommit && validationErrorCommitMessages) {
    core.setFailed(validationErrorPrTitleOrSingleCommit.message + " / " + validationErrorCommitMessages.message);
}
