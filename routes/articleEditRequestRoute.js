const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authentcatetoken');
const adminAuthenticateToken = require("../middleware/adminAuthenticateToken");

const{
    submitEditRequest,
    getAllImprovementsForReview,
    getAllInProgressImprovementsForAdmin,
    getAllCompletedImprovementsForAdmin,
    pickImprovementRequest,
    submitReviewOnImprovement,
    submitImprovement,
    detectContentLoss, 
    discardImprovement,
    publishImprovement,
    unassignModerator
}= require('../controllers/admin/articleEditRequestController');

/**
 * @openapi
 * /article/submit-edit-request:
 *   post:
 *     summary: Submit an edit request for an article
 *     description: |
 *       Allows a logged-in user to submit an edit request on a specific article.
 *       The user must provide the article ID, a reason for the edit, and the article record ID.
 *       Users can have up to 2 open edit requests at a time.
 *       Blocked or banned users are not permitted to submit requests.
 *     tags:
 *       - ArticlesEditRequest
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - article_id
 *               - edit_reason
 *               - article_recordId
 *             properties:
 *               article_id:
 *                 type: integer
 *                 description: ID of the article for which the edit request is submitted
 *                 example: 123
 *               edit_reason:
 *                 type: string
 *                 description: Explanation or reason for requesting the edit
 *                 example: Typo found in the third paragraph
 *               article_recordId:
 *                 type: string
 *                 description: External record ID of the article (e.g., Pocketbase record ID)
 *                 example: abc123xyz
 *     responses:
 *       '200':
 *         description: Edit request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Your edit request has been successfully created and is being processed.
 *                 data:
 *                   type: object
 *                   $ref: '#/components/schemas/EditRequest'
 *                   description: The newly created edit request details
 *       '400':
 *         description: Missing or invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article Id , User Id, article record id, Edit Reason required
 *       '401':
 *         description: Unauthorized - User must be authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       '403':
 *         description: Forbidden - user is blocked, banned, or has exceeded edit request limit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: You are not permitted to submit edit request at this moment
 *       '404':
 *         description: Article or user not found, or article removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Article or user not found
 *       '500':
 *         description: Internal server error while processing the request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

router.post('/article/submit-edit-request', authenticateToken, submitEditRequest);


/**
 * @openapi
 * /admin/available-improvements:
 *   get:
 *     summary: Get all unassigned article edit requests for review
 *     description: |
 *       Retrieves a paginated list of all article improvement (edit) requests that are pending review (i.e., have a status of "UNASSIGNED").
 *       Only articles by active (non-blocked and non-banned) authors are included.
 *       This route is protected and requires a valid JWT.
 *     tags:
 *       - ArticlesEditRequest
 *     security:
 *       - bearerAuth: []  
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
 *         description: Number of results per page
 *     responses:
 *       '200':
 *         description: List of unassigned edit requests for review
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 articles:
 *                   type: array
 *                   description: List of unassigned edit requests
 *                   items:
 *                     type: object
 *                     $ref: '#/components/schemas/EditRequest'
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages (only returned on first page)
 *       '401':
 *         description: Unauthorized - User or admin must be authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

router.get('/admin/available-improvements', adminAuthenticateToken, getAllImprovementsForReview);

router.get('/admin/progress-improvements', adminAuthenticateToken, getAllInProgressImprovementsForAdmin);
router.get('/admin/publish-improvements', adminAuthenticateToken, getAllCompletedImprovementsForAdmin);
router.post('/admin/approve-improvement-request', adminAuthenticateToken, pickImprovementRequest);
router.post('/admin/submit-review-on-improvement', adminAuthenticateToken, submitReviewOnImprovement);
router.post('/article/submit-improvement', authenticateToken, submitImprovement);
router.get('/article/detect-content-loss', adminAuthenticateToken, detectContentLoss);
router.post('/admin/discard-improvement', adminAuthenticateToken, discardImprovement);
router.post('/admin/publish-improvement', adminAuthenticateToken, publishImprovement);
router.post('/admin/improvement/unassign-moderator', adminAuthenticateToken, unassignModerator);


module.exports = router;