const core = require('@actions/core');

const validatePrTitleOrSingleCommit = require('./src/validatePrTitleOrSingleCommit');
const validateCommitMessages = require('./src/validateCommitMessages');

let validationErrorPrTitleOrSingleCommit;
let validationErrorCommitMessages;

try {
    validatePrTitleOrSingleCommit();
} catch (error) {
    validationErrorPrTitleOrSingleCommit = error;
}

try {
    validateCommitMessages();
} catch (error) {
    validationErrorCommitMessages = error;
}

if (validationErrorPrTitleOrSingleCommit && validationErrorCommitMessages) {
    core.setFailed(validationErrorPrTitleOrSingleCommit.message + " / " + validationErrorCommitMessages.message);
}
