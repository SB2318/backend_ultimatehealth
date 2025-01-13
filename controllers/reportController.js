const expressAsyncHandler = require("express-async-handler");
const Report = require("../models/reportModel");
const Reason = require("../models/reportModel");
const Article = require('../models/Articles');
const User = require("../models/UserModel");

// Add Reason
module.exports.addReason = expressAsyncHandler(

    async (req, res) =>{
        const {reason} = req.body;

        if(!reason){
            return res.status(400).json({message: "Please add a reason."});
        }

        try{
            await Reason.create({reason});
            res.status(201).json({message: "Reason added successfully."});
        }catch(err){
            return res.status(500).json({message: "Failed to add reason, Internal server error"});
        }
    }
)
// Update Reason
module.exports.updateReason = expressAsyncHandler(
    async (req, res) =>{

         const {id,reason} = req.body;

         if(!id || !reason){
          return res.status(400).json({message: "Please add a id and reason."});
         }

         try{
            const reason = await Reason.findById(id);
            if(!reason){
              return res.status(404).json({message: "Reason not found."});
            }
            reason.reason = reason;
            await reason.save();
            res.status(200).json({message: "Reason updated successfully."});
         }catch(err){
            console.log(err);
            return res.status(500).json({message: "Failed to update reason, Internal server error"});
         }
    }
)
// Delete Reason
module.exports.deleteReason = expressAsyncHandler(
    async (req, res) =>{

         const id = req.params.id;

         if(!id){
            return res.status(400).json({message: "id not found"});
         }

         try{
            const reason = await Reason.findById(Number(id));
            if(!reason){
                return res.status(404).json({message: "Reason not found."});
            }
            await reason.remove();
            res.status(200).json({message: "Reason deleted successfully."});
         }
         catch(err){
            console.log(err);
            return res.status(500).json({message: "Failed to delete reason, Internal server error"});
         }
    }
)
// Get all Reasons
module.exports.getAllReasons = expressAsyncHandler(

    async (req, res) => {
       
        try{
            const reasons = await Reason.find().sort({createdAt: -1});
            res.status(200).json(reasons);
        }catch(err){
            console.log(err);
            return res.status(500).json({message:"Internal server error"});
        }
    }
)
// Submit Report
module.exports.submitReport = expressAsyncHandler(
    async (req, res) =>{

        const {articleId, commentId, reportedBy, reasonId} = req.body;

        if(!articleId || !reportedBy || !reasonId){
            return res.status(400).json({message: "Please fill in all fields."});
        }

        try{

             const [article, user, reason] = await Promise.all(
                [
                    Article.findById(Number(articleId)),
                    User.findById(reportedBy),
                    Reason.findById(Number(reasonId)),
                ]
             );

             if(!article){
                return res.status(404).json({message: "Article not found."});
             }
             if(!user){
                return res.status(404).json({message: "User not found."});
             }
             if(!reason){
                return res.status(404).json({message: "Please select a valid reason"});
             }

             const report = new Report({
                articleId: Number(articleId),
                commentId: commentId,
                reportedBy: reportedBy,
                reasonId: Number(reasonId),
                
             });

             await report.save();

             res.status(201).json({message: "Report submitted successfully"});
             
        }catch(err){
            console.log(err);
            return res.status(500).json({message: "Internal server error"});
        }
    }
)
// Send Mail (Optional)
// Get all reports (later)