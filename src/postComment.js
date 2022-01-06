/*eslint no-undef: 0*/
/**
 * Post a comment to the PR
 * @param {Object} octokit
 * @param {Object} context
 * @param {String} commentHeader
 * @param {String} comment
 * @return {Promise}
 */
module.exports = function postComment(
  octokit,
  context,
  commentHeader,
  comment
) {
  //there's no API to update a comment, so we
  //keep track of comments by inserting an hidden comment
  //and removing the previous
  return octokit.issues
    .listComments({
      repo: context.repo.repo,
      owner: context.repo.owner,
      issue_number: context.payload.pull_request.number
    })
    .then((results) => {
      const {data: existingComments} = results;

      return existingComments.filter(({body}) =>
        body.startsWith(commentHeader)
      );
    })
    .then((toDelete) => {
      if (Array.isArray(toDelete)) {
        return Promise.all(
          toDelete.map(({id}) =>
            octokit.issues.deleteComment({
              repo: context.repo.repo,
              owner: context.repo.owner,
              comment_id: id
            })
          )
        );
      }
    })
    .then(() =>
      octokit.issues.createComment({
        repo: context.repo.repo,
        owner: context.repo.owner,
        issue_number: context.payload.pull_request.number,
        body: `${commentHeader}\n${comment}`
      })
    );
};
