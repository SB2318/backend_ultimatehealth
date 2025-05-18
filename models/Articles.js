const ArticleTag = require('../models/ArticleModel');
const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const AutoIncrement = require('mongoose-sequence')(mongoose);

const articleSchema = new Schema({
  _id: {
    type: Number,
    autoIncrement: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
    default:''
  },
  authorName: {
    type: String,
    required: true,
  },
  authorId: {
    type: Schema.Types.ObjectId, // Reference to User
    required: true,
    ref: 'User'
  },
  contributors:
    {
      type: [Schema.Types.ObjectId], // Reference to User ho edited the article
      ref: 'User',
      default:[]
    },
  
  content: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    default: null,
  },
  publishedDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    required: true,
    default: Date.now,
  },
  tags: {
    type: [Schema.Types.ObjectId], // Reference to ArticleTag
    ref: 'ArticleTag',
    default: []
  },
 
  imageUtils: {
    type: [String],
    required: true,
  },
  viewCount: {
    type: Number,
    required: true,
    default: 0,
  },
  likeCount: {
    type: Number,
    required: true,
    default: 0,
  },
 
  language: {
    type: String,
    required: true,
    default: 'English',
  },
  adminPost: {
    type: Boolean,
    required: true,
    default: false,
  },
  likedUsers: {
    type: [Schema.Types.ObjectId],
    ref: 'User', // Reference to User
    default: []
  },

  repostUsers: {
    type: [Schema.Types.ObjectId],
    ref: 'User', // Reference to User
    default: []
  },
  savedUsers: {
    type: [Schema.Types.ObjectId],
    ref: 'User', // Reference to User
    default: []
  },
  viewUsers: {
    type: [Schema.Types.ObjectId],
    ref: 'User', 
    default: []
  },
  mentionedUsers: {
    type: [Schema.Types.ObjectId],
    ref: 'User', 
    default: []
  },

  status :{
    type: String,
    enum: ['unassigned', 'in-progress', 'review-pending',  'published', 'discarded','awaiting-user'],
    default: 'unassigned'
  },

  assigned_date:{
     type: Date,
     default: null
  },
  reviewer_id:{
    type: Schema.Types.ObjectId,
    ref: 'admin', 
    default: null
 },

  review_comments:
  {
      type: [Schema.Types.ObjectId],
      ref: 'Comment',
      default: []
  },
  

  discardReason:{
    type: String,
    default: "Discarded by system"
  },

  is_removed:{
    type: Boolean,
    default: false
  },
  reportId:{
    type: Schema.Types.ObjectId,
    default: null,
    ref:"ReportAction"
  }
});

// Apply the autoIncrement plugin to the schema
articleSchema.plugin(AutoIncrement, { id: 'article_id_counter', inc_field: '_id' });

const Article = mongoose.model('Article', articleSchema);

module.exports = Article;
