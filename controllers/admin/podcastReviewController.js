const expressAsyncHandler = require('express-async-handler');
const Article = require('../../models/Articles');
const admin = require('../../models/admin/adminModel');
const User = require('../../models/UserModel');
const WriteAggregate = require("../../models/events/writeEventSchema");
//const { sendArticleFeedbackEmail, sendArticlePublishedEmail, sendArticleDiscardEmail, sendMailArticleDiscardByAdmin } = require('../emailservice');
const cron = require('node-cron');
const statusEnum = require('../../utils/StatusEnum');
const AdminAggregate = require('../../models/events/adminContributionEvent');

// Available podcast review
// Get all podcast for moderator
// Pick Podcast
// Appprove podcast (Increase the count of admin contribution, increase the count of user contribution)
// Discard podcast