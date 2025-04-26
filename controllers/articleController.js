const expressAsyncHandler = require("express-async-handler");
const ArticleTag = require("../models/ArticleModel");
const Article = require("../models/Articles");
const User = require("../models/UserModel");
const EditRequest = require('../../models/admin/articleEditRequestModel');
const ReadAggregate = require("../models/events/readEventSchema");
const WriteAggregate = require("../models/events/writeEventSchema");
const statusEnum = require("../utils/StatusEnum");


const mongoose = require('mongoose');
// Create a new article
module.exports.createArticle = async (req, res) => {
  try {
    const { authorId, title, authorName, description, content, tags, imageUtils } = req.body; // Destructure required fields from req.body


    if(!authorId || !title || !authorName || !description || !content || !tags || !imageUtils){
      return res.status(400).json({ message: "Please fill in all fields: authorId, title, authorName, description, content, tags, imageUtils" });
    }
    // Find the user by ID
    const user = await User.findById(authorId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Create a new article instance
    const newArticle = new Article({
      title,
      authorName,
      content,
      tags,
      description,
      imageUtils,
      authorId: user._id, // Set authorId to the user's ObjectId
    });

    newArticle.mentionedUsers.push(user._id); // Initially all can mention the author.
    // Save the new article to the database
    await newArticle.save();

    // Update the user's articles field
    user.articles.push(newArticle._id);

    // await updateWriteEvents(newArticle._id, user.id);

    await user.save();

    // Respond with a success message and the new article
    res.status(201).json({ message: "Article under reviewed", newArticle });
  } catch (error) {
    console.log("Article Creation Error", error);
    res.status(500).json({ error: "Error creating article", details: error.message });
  }
};

// Get all articles (published)
module.exports.getAllArticles = async (req, res) => {
  try {

  
    const articles = await Article.find({ status: statusEnum.statusEnum.PUBLISHED })
      .populate('tags')
      .populate('mentionedUsers', 'user_handle user_name Profile_image')
      .populate('likedUsers', 'Profile_image') 
      .exec();
   

      articles.forEach(article => {
        article.likedUsers.reverse(); 
      });
    res.status(200).json({ articles });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error fetching articles", details: error.message });
  }
};

// Get an article by ID
module.exports.getArticleById = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate('tags')
      .populate('likedUsers') // This populates the tag data
      .exec();
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }
    res.status(200).json({ article });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error fetching article", details: error.message });
  }
};

// Update an article by ID
module.exports.updateArticle = async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate('tags') // This populates the tag data
      .exec();
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }
    // await article.save();
    res.status(200).json({ message: "Article updated successfully", article });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error updating article", details: error.message });
  }
};

// Delete an article by ID
module.exports.deleteArticle = async (req, res) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id)
      .populate('tags') // This populates the tag data
      .exec();
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }
    res.status(200).json({ message: "Article deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error deleting article", details: error.message });
  }
};

// Save Article : (published article)
module.exports.saveArticle = async (req, res) => {
  try {
    const { article_id } = req.body;

    if (!article_id) {
      return res.status(400).json({ message: "User ID and Article ID are required" });
    }
    const user = await User.findById(req.userId);
    const article = await Article.findById(article_id)
      .populate('tags') // This populates the tag data
      .exec();

    if (!user || !article) {
      return res.status(404).json({ error: 'User or article not found' });
    }

    if (article.status !== statusEnum.statusEnum.PUBLISHED) {
      return res.status(400).json({ message: 'Article is not published' });
    }
    // Check if the article is already saved
    //const isArticleSaved = user.savedArticles.includes(id => id === article_id);
    const savedArticlesSet = new Set(user.savedArticles);
    const isArticleSaved = savedArticlesSet.has(article_id);

    if (isArticleSaved) {

      // unsave article
      await Promise.all([
        Article.findByIdAndUpdate(article_id, {
          $pull: { savedUsers: req.userId } // Remove user from savedUsers
        }),
        User.findByIdAndUpdate(req.userId, {
          $pull: { savedArticles: article_id } // Remove article from savedArticles
        })
      ]);
      res.status(200).json({ message: 'Article unsaved' });

    }
    else {
      await Promise.all([
        Article.findByIdAndUpdate(article_id, {
          $addToSet: { savedUsers: req.userId } // Add user to savedUsers
        }),
        User.findByIdAndUpdate(req.userId, {
          $addToSet: { savedArticles: article_id } // Add article to savedArticles
        })
      ]);
      res.status(200).json({ message: 'Article saved successfully' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error saving article', details: error.message });
  }
};

// Like Articles (published article)
module.exports.likeArticle = async (req, res) => {
  try {
    const { article_id } = req.body;

    if (!article_id) {
      return res.status(400).json({ message: "Article ID and User ID are required" });
    }

    const user = await User.findById(req.userId);

    const articleDb = await Article.findById(article_id)
      .populate(['tags', 'likedUsers']) // This populates the tag data
      .exec();

    if (!user || !articleDb) {
      return res.status(404).json({ error: 'User or Article not found' });
    }


    if (articleDb.status !== statusEnum.statusEnum.PUBLISHED) {
      return res.status(400).json({ message: 'Article is not published' });
    }
    // Check if the article is already liked
    const likedArticlesSet = new Set(user.likedArticles);
    const isArticleLiked = likedArticlesSet.has(article_id);
    //console.log("Article Id", article_id);

    // console.log('Liked Articles', user.likedArticles);
    //  console.log('Article Liked', isArticleLiked );
    //  console.log('Liked Users', articleDb.likedUsers);
    if (isArticleLiked) {

      // Unlike It
      await Promise.all([
        Article.findByIdAndUpdate(article_id, {
          $pull: { likedUsers: req.userId } // Remove user from likedUsers
        }),
        User.findByIdAndUpdate(req.userId, {
          $pull: { likedArticles: article_id } // Remove article from likedArticles
        })
      ]);

      articleDb.likeCount = Math.max(articleDb.likeCount - 1, 0); // Decrement like count
      await articleDb.save();

      return res.status(200).json({ message: 'Article unliked successfully', data:{
        article: articleDb,
        likeStatus: false
      } });

    } else {
      await Promise.all([
        Article.findByIdAndUpdate(article_id, {
          $addToSet: { likedUsers: req.userId } // Add user to likedUsers
        }),
        User.findByIdAndUpdate(req.userId, {
          $addToSet: { likedArticles: article_id } // Add article to likedArticles
        })
      ]);

      articleDb.likeCount++;
      await articleDb.save();

      return res.status(200).json({ message: 'Article liked successfully', data:{
        article: articleDb,
        likeStatus: true
      } });
    }

  } catch (error) {
    res.status(500).json({ error: 'Error liking article', details: error.message });
  }
};

// Update View Count (Published article)
module.exports.updateViewCount = async (req, res) => {
  const { article_id } = req.body;
  const user = await User.findById(req.userId);

  try {
    const articleDb = await Article.findById(article_id)
      .populate(['tags', 'likedUsers'])
      .exec();

    if (!user || !articleDb) {
      return res.status(404).json({ error: 'User or Article not found' });
    }

    if (articleDb.status !== statusEnum.statusEnum.PUBLISHED) {
      return res.status(400).json({ message: 'Article is not published' });
    }

    // Check if the user has already viewed the article
    const userId = new mongoose.Types.ObjectId(req.userId);
    const hasViewed = articleDb.viewUsers.some(id => id.equals(userId));
    // console.log('Has Viewed', hasViewed)
    // console.log('Article View Users', articleDb.viewUsers);

    if (hasViewed) {
      return res.status(200).json({ message: 'Article already viewed by user', article: articleDb });
    }

    // Increment view count and add user to viewUsers
    articleDb.viewCount += 1;
    articleDb.viewUsers.push(req.userId);

    await articleDb.save();
    res.status(200).json({ message: 'Article view count updated', article: articleDb });

  } catch (err) {
    res.status(500).json({ error: 'Error updating view', details: err.message });
  }
}


// Helper function to get the next id
const getNextId = async () => {
  const tags = await ArticleTag.find().sort({ id: -1 }).limit(1);
  return tags.length === 0 ? 1 : tags[0].id + 1;
};

// Create a new tag
exports.addNewTag = async (req, res) => {
  try {
    const { name } = req.body;
    const id = await getNextId();
    const newTag = new ArticleTag({ id, name });
    await newTag.save();
    res.status(201).json(newTag);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all tags
exports.getAllTags = async (req, res) => {
  try {
    const tags = await ArticleTag.find();
    res.status(200).json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a tag by id
exports.updateTagById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedTag = await ArticleTag.findOneAndUpdate(
      { id },
      { name },
      { new: true }
    );
    if (!updatedTag) {
      return res.status(404).json({ error: "Tag not found" });
    }
    res.status(200).json(updatedTag);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a tag by id
exports.deleteArticleTagByIds = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTag = await ArticleTag.findOneAndDelete({ id });
    if (!deletedTag) {
      return res.status(404).json({ error: "Tag not found" });
    }
    res.status(200).json({ message: "Tag deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Read Event API
// Update User Read Event
exports.updateReadEvents = async (req, res) => {

  const { article_id } = req.body;

  if (!article_id) {
    return res.status(400).json({ error: "Article ID is required" });
  }

  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));

  try {
    // New Read Event Entry
 // console.log("Today", today);
 // console.log("Read event post", req.userId);
    const readEvent = await ReadAggregate.findOne({ userId: req.userId, date:today});

    if(!readEvent){
      // Create New
    //  console.log("Enter if block");
      const newReadEvent = new ReadAggregate({ userId: req.userId, date:today});
      newReadEvent.dailyReads =1;
      newReadEvent.monthlyReads =1;
      newReadEvent.yearlyReads =1;
      newReadEvent.date = today;
      await newReadEvent.save();
      
    res.status(201).json({ message: 'Read Event Saved', event:newReadEvent });
    }else{
      readEvent.dailyReads +=1;
      readEvent.monthlyReads +=1;
      readEvent.yearlyReads +=1;
     
      await readEvent.save();
      
    res.status(201).json({ message: 'Read Event Saved', event:readEvent });
    }
  } catch (err) {
    console.log('Article Read Event Update Error', err);
    res.status(500).json({ error: err.message });
  }
}

// GET ALL READ EVENTS STATUS DAILY, WEEKLY, MONTHLY
exports.getReadDataForGraphs = async (req, res) => {

  const  userId  = req.userId;
  //console.log("Read event", userId);
  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const yearStart = new Date(today.getFullYear(), 0, 1);

    const dailyData = await ReadAggregate.find({ userId, date: today });
    const monthlyData = await ReadAggregate.find({ userId, date: { $gte: monthStart } });
    const yearlyData = await ReadAggregate.find({ userId, date: { $gte: yearStart } });

    res.status(200).json({
      dailyReads: {
        date: today.toISOString().slice(0, 10), // Today's date
        count: dailyData ? dailyData.dailyReads : 0 // Reads today
    },
    monthlyReads: monthlyData.map(entry => ({
        date: entry.date.toISOString().slice(0, 10), // Date of the month
        count: entry.monthlyReads // Reads on that day
    })),
    yearlyReads: yearlyData.map(entry => ({
        month: entry.date.toISOString().slice(0, 7), // Month formatted as YYYY-MM
        count: entry.yearlyReads // Reads for that month
    })),
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching read data' });
  }
};





// GET ALL Write EVENTS STATUS DAILY, WEEKLY, MONTHLY
exports.getWriteDataForGraphs = async (req, res) => {

  const  userId  = req.userId;

  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const yearStart = new Date(today.getFullYear(), 0, 1);

    const dailyData = await WriteAggregate.find({ userId, date: today });
    const monthlyData = await WriteAggregate.find({ userId, date: { $gte: monthStart } });
    const yearlyData = await WriteAggregate.find({ userId, date: { $gte: yearStart } });

    res.status(200).json({
      dailyWrites: {
        date: today.toISOString().slice(0, 10), // Today's date
        count: dailyData ? dailyData.dailyWrites : 0 // Writes today
    },
    monthlyWrites: monthlyData.map(entry => ({
        date: entry.date.toISOString().slice(0, 10), // Date of the month
        count: entry.monthlyWrites // Writes on that day
    })),
    yearlyWrites: yearlyData.map(entry => ({
        month: entry.date.toISOString().slice(0, 7), // Month formatted as YYYY-MM
        count: entry.yearlyWrites // Writes for that month
    })),
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching read data' });
  }
};

// Repost Article (Published article)
exports.repostArticle = expressAsyncHandler(
  async (req, res) => {

    try{
  
      const {articleId} = req.body;
      const userId  = req.userId;
  
      if(!articleId){
         res.status(400).json({error: 'Article ID is required.'});
         return;
      }
  
      const [article, user] = await Promise.all([
        Article.findById(Number(articleId)),
        User.findById(userId),
      ]);
  
      if(!article || !user){
        res.status(404).json({error: 'Article or user not found.'});
        return;
      }
      
      if (article.status !== statusEnum.statusEnum.PUBLISHED) {
        return res.status(400).json({ message: 'Article is not published' });
      }
      // Check if user has already reposted the article
         // Check if the article is already liked
         const repostArticlesSet = new Set(user.repostArticles);
         const isArticleRepost = repostArticlesSet.has(article._id);
  
        if(isArticleRepost){
          user.repostArticles = user.repostArticles.filter(id => id !== article._id);
          user.repostArticles.unshift(article._id); // unshift will add one element at the beginning of the array
          await user.save();
        }else{
          user.repostArticles.push(article._id);
          await user.save();
          article.repostUsers.push(user._id);
          await article.save();
        }
  
        res.status(200).json({message:"Article reposted successfully"});
  
    }catch(err){
      console.log('Error reposting article', err);
      res.status(500).json({message:"Internal server error"});
    }
  
  }
)

module.exports.getAllImprovementsForUser = expressAsyncHandler(
  async (req, res) => {
      const userId  = req.userId;
      if (!userId) {
          return res.status(400).json({ message: 'User ID is required.' });
      }
      try {
          const articles = await EditRequest.find({
                user_id: userId, 
                
          }).populate('article').exec();

          res.status(200).json(articles);
      } catch (err) {
          console.log(err);
          res.status(500).json({ message: err.message });
      }
  }
)
