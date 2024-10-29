const expressAsyncHandler = require("express-async-handler");
const Article = require("../models/Articles");
const User = require("../models/UserModel");
const ReadAggregate = require("../models/events/readEventSchema");
const WriteAggregate = require("../models/events/writeEventSchema");

const targetReads = 100000
const targetWrites = 5000
const targetLikes = 100000
const targetViews = 10000000

module.exports.getTotalReadCountOfUser = expressAsyncHandler(
    async (req, res) => {
       const userId = req.params.userId;

       if(!userId){
        res.status(400).json({message:'user id is required'});
       }
       try{

        const aggregates = await ReadAggregate.find({userId});

        // Count Reads
        const totalReads = aggregates.reduce((acc, curr) => acc + curr.dailyReads, 0);
        
        // Measure progress , here my current needs between 0 to 1
       
        // Threshold is 0.01
        const progress = Math.max(Math.min(totalReads / targetReads, 1), 0.01);

        return res.status(201).json({
            totalReads,
            progress
        });
       }catch(err){

          console.log('Total Reads Error', err);
          res.status(500).json({message:'Internal server error'});
       }
    }
)

module.exports.getTotalWriteCountOfUser = expressAsyncHandler(

    async (req, res)=>{
        const userId = req.params.userId;

        if(!userId){
            res.status(400).json({message:'user id is required'});
           }
           try{
    
            const aggregates = await WriteAggregate.find({userId});
    
            // Count Writes
            const totalWrites = aggregates.reduce((acc, curr) => acc + curr.dailyWrites, 0);
            
            // Measure progress , here my current needs between 0 to 1
    
            // Threshold is 0.01
            const progress = Math.max(Math.min(totalWrites / targetWrites, 1),0.01);
    
            return res.status(201).json({
                totalWrites,
                progress
            });
           }catch(err){
    
              console.log('Total Reads Error', err);
              res.status(500).json({message:'Internal server error'});
           }
    }
)

module.exports.getTotalLikeAndViewReceivedByUser = expressAsyncHandler(

    async (req, res)=>{

        const { userId } = req.params;

        if(!userId){
            res.status(400).json({message:'user id is required'});
        }

        try{

        const articles = await Article.find({ authorId: userId });

        // O(n)
        const totalLikes = articles.reduce((acc, curr) => acc + curr.likedUsers.length, 0);
        const totalViews = articles.reduce((acc, curr) => acc + curr.viewUsers.length, 0);

        // Threshold is 0.01
        const likeProgress = Math.max(Math.min(totalLikes / targetLikes, 1), 0.01);
        const viewProgress = Math.max(Math.min(totalViews / targetViews, 1), 0.01);

        return res.status(201).json({
            totalLikes,
            totalViews,
            likeProgress,
            viewProgress
        });


        }catch(err){

        }
    }
)

module.exports.getMostViewedArticles = expressAsyncHandler(

    async (req, res) =>{

        const {userId} = req.params;

        if(!userId){
            res.status(400).json({message:'user id is required'});
        }
        try{

            const articles = await Article.find({ authorId: userId }) 
            //.sort({ 'viewUsers.length': -1 }) // Sort by viewCount in descending order
            //.limit(5)
            .populate('tags')
            .select('imageUtils title viewUsers lastUpdated'); 

            const sortedArticles = articles.sort((a, b) => b.viewUsers.length - a.viewUsers.length);

            // Limit to top 5 articles
            const topArticles = sortedArticles.slice(0, 5);
    
            return res.status(200).json(topArticles);

        }catch(err){
            console.log('Most View Article Error', err);

        }
    }
)

