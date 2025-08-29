const express = require("express");
const { getAllArticleForReview, assignModerator, submitReview, submitSuggestedChanges, unassignModerator, publishArticle, getAllInProgressArticles, getAllReviewCompletedArticles, discardChanges } = require("../controllers/admin/articleReviewController");
const authenticateToken = require("../middleware/adminAuthenticateToken"); // admin token
const authToken = require("../middleware/authentcatetoken"); // user token
const router = express.Router();

/**
 * @openapi
 * /admin/articles-for-review:
 *   get:
 *     summary: Get all unassigned articles for review
 *     description: |
 *       Retrieves paginated articles which are unassigned, not removed,
 *       and written by authors who are not blocked or banned.
 *     security:
 *       - bearerAuth: []
 *     tags: [Articles]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of articles per page
 *     responses:
 *       200:
 *         description: List of articles for review
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 articles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Article'
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages (only for page 1)
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.get('/admin/articles-for-review', authenticateToken, getAllArticleForReview);

/**
 * @swagger
 * /admin/review-progress/:reviewer_id:
 *   get:
 *     summary: Get all in-progress articles assigned to a reviewer or moderator
 *     description: |
 *       Retrieves a paginated list of articles that are:
 *       - Assigned to a specific reviewer
 *       - Not removed
 *       - In one of these statuses: IN_PROGRESS, AWAITING_USER, REVIEW_PENDING
 *       - Written by users who are not blocked or banned
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the reviewer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of articles per page
 *     responses:
 *       200:
 *         description: List of in-progress articles for the reviewer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 articles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Article'
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages (only on page 1)
 *       400:
 *         description: Bad Request - Reviewer ID not provided
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 * 
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get('/admin/review-progress/:reviewer_id', authenticateToken, getAllInProgressArticles);

/**
 * @openapi
 * /admin/review-completed/:reviewer_id:
 *   get:
 *     summary: Get all review-completed articles for a reviewer
 *     description: |
 *       Retrieves a paginated list of articles reviewed by a specific reviewer,
 *       where the article status is either `PUBLISHED` or `DISCARDED` and not removed.
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the reviewer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of articles per page
 *     responses:
 *       200:
 *         description: List of review-completed articles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 articles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Article'
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages (returned only on first page)
 *       400:
 *         description: Bad Request - Reviewer ID not provided
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.get('/admin/review-completed/:reviewer_id', authenticateToken, getAllReviewCompletedArticles);

/**
 * @openapi
 * /admin/moderator-self-assign:
 *   post:
 *     summary: Assign a moderator and start article review
 *     description: |
 *       Assigns a moderator (reviewer) to an unassigned article, updates the article's status to `IN_PROGRESS`, and notifies the author.
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *                 description: ID of the article to assign
 *               moderatorId:
 *                 type: string
 *                 description: ID of the moderator (admin) to assign
 *             required:
 *               - articleId
 *               - moderatorId
 *     responses:
 *       200:
 *         description: Article status updated and assigned to moderator
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article status updated
 *       400:
 *         description: Missing or invalid input, or article not eligible for assignment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Please provide articleId and moderatorId
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       404:
 *         description: Article or moderator not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article or Moderator not found
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.post('/admin/moderator-self-assign', authenticateToken, assignModerator);

/**
 * @openapi
 * /admin/submit-review:
 *   post:
 *     summary: Submit review feedback on an article
 *     description: |
 *       Allows a moderator (reviewer) to submit feedback on an article. 
 *       Saves the comment, updates the article's status to `AWAITING_USER`, 
 *       notifies the author, and sends a feedback email.
 *     tags : [Articles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *                 description: ID of the article being reviewed
 *               reviewer_id:
 *                 type: string
 *                 description: ID of the reviewer submitting the review
 *               feedback:
 *                 type: string
 *                 description: Feedback content for the article
 *             required:
 *               - articleId
 *               - reviewer_id
 *               - feedback
 *     responses:
 *       200:
 *         description: Review submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Review submitted
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Please fill all fields: articleId, reviewer_id, reviewContent'
 *       403:
 *         description: Reviewer not authorized to access this article
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: You are not authorized to access this article
 *       404:
 *         description: Article or reviewer not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article or Moderator not found
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.post('/admin/submit-review', authenticateToken, submitReview);



/**
 * @openapi
 * /admin/submit-suggested-changes:
 *   post:
 *     summary: Submit suggested changes to an article by the author
 *     description: |
 *       Allows the author of an article to submit updated content, title, summary, tags, image metadata, etc.
 *       
 *       - If the article has already been assigned to a reviewer (i.e., it's under review), its status will be changed to `REVIEW_PENDING`.
 *       - The assigned reviewer is notified via the internal notification system.
 *       - The notification includes the article title and a message asking the reviewer to check the changes submitted by the author.
 *       
 *       This endpoint also:
 *       - Ensures the user is the actual author of the article.
 *       - Prevents blocked or banned users from submitting updates.
 *     tags : [Articles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - articleId
 *               - content
 *               - title
 *               - description
 *               - tags
 *               - authorName
 *               - imageUtils
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user (author) submitting the changes
 *               articleId:
 *                 type: string
 *                 description: ID of the article being updated
 *               content:
 *                 type: string
 *                 description: Updated content/body of the article
 *               title:
 *                 type: string
 *                 description: Updated title of the article
 *               description:
 *                 type: string
 *                 description: Short summary or description of the article
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of updated tag IDs
 *               authorName:
 *                 type: string
 *                 description: Updated author name to display with the article
 *               imageUtils:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Object containing image metadata or image URL(s)
 *                 
 *     responses:
 *       200:
 *         description: Article submitted successfully and reviewer notified (if applicable)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article submitted
 *       400:
 *         description: Missing required fields in the request body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Missing required fields: userId, articleId, content'
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       403:
 *         description: User is blocked, banned, or not the author of the article
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: You are not the author of this article
 *       404:
 *         description: Article or user not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.post('/admin/submit-suggested-changes',authToken, submitSuggestedChanges);
//router.get('/admin/moderator/:moderatorId/articles', getAllArticlesForAssignModerator);

/**
 * @openapi
 * /admin/publish-article:
 *   post:
 *     summary: Publish an article after review
 *     description: |
 *       Publishes a reviewed article if all validations pass:
 *       - Article and reviewer must exist
 *       - Article must be assigned to this reviewer
 *       - Author must not be blocked or banned
 *       - Article must not already be removed
 *       
 *       After publishing:
 *       - Article status is set to `PUBLISHED`
 *       - `publishedDate` and `lastUpdated` timestamps are updated
 *       - Admin contribution is recorded
 *       - Notification and email are sent to the author
 *     tags:
 *       - Articles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - articleId
 *               - reviewer_id
 *             properties:
 *               articleId:
 *                 type: string
 *                 description: ID of the article to be published
 *               reviewer_id:
 *                 type: string
 *                 description: ID of the reviewer publishing the article
 *     responses:
 *       200:
 *         description: Article published successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article Published
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article ID and Reviewer ID are required
 *       403:
 *         description: Article is not assigned to this reviewer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article is not assigned to this reviewer
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       404:
 *         description: Article, reviewer, or valid author not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article or Reviewer not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.post('/admin/publish-article', authenticateToken, publishArticle);

/**
 * @openapi
 * /admin/discard-changes:
 *   post:
 *     summary: Discard article changes and remove reviewer assignment
 *     description: |
 *       Discards the changes submitted by the author for an article. This endpoint:
 *       - Unassigns the reviewer from the article
 *       - Updates article status to `DISCARDED`
 *       - Deletes the article record from PocketBase
 *       - Deletes all images from AWS S3
 *       - Sends an email notification to the author with the discard reason
 *     tags:
 *       - Articles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - articleId
 *               - discardReason
 *             properties:
 *               articleId:
 *                 type: string
 *                 description: ID of the article to discard
 *               discardReason:
 *                 type: string
 *                 description: Reason for discarding the article (sent to the author)
 *     responses:
 *       200:
 *         description: Article discarded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article Discarded
 *       400:
 *         description: Missing articleId or discard reason
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid request, please provide discard reason and article id
 * 
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       404:
 *         description: Article not found or already removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.post('/admin/discard-changes', authenticateToken, discardChanges);

/**
 * @openapi
 * /admin/unassign-moderator:
 *   post:
 *     summary: Unassign reviewer from an article
 *     description: |
 *       Unassigns a reviewer (moderator) from the given article.
 *       
 *       This endpoint:
 *       - Checks if the article exists and is not removed
 *       - Prevents unassignment if the article is already published
 *       - Clears the reviewer assignment
 *       - Sets the article status to `UNASSIGNED`
 *       - Notifies the author about the unassignment
 *     tags:
 *       - Articles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - articleId
 *             properties:
 *               articleId:
 *                 type: string
 *                 description: ID of the article to unassign the moderator from
 *     responses:
 *       200:
 *         description: Article unassigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article unassigned
 *       400:
 *         description: Article ID missing in request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article id required
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       403:
 *         description: Article already published and cannot be unassigned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article already published
 *       404:
 *         description: Article not found or has been removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.post('/admin/unassign-moderator', authenticateToken, unassignModerator);

module.exports = router;