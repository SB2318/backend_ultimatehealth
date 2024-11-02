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

exports.getDailyReadDataForGraphs = expressAsyncHandler(
    async (req, res) => {
        //const { userId } = req.user;
        const {userId, specificDay } = req.query; 
    
        if(!userId || !specificDay){
            res.status(400).json({message:'User Id and day is required'});
        }
      
        try {
          const today = new Date();
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const monthEnd = new Date();  //
      
          const dayIndex = parseInt(specificDay, 10); 
          const validDays = [0, 1, 2, 3, 4, 5, 6]; // Sunday to Saturday
      
          if (validDays.includes(dayIndex)) {
            const weeklyData = [];
      
            for (let date = monthStart; date <= monthEnd; date.setDate(date.getDate() + 1)) {
              if (date.getDay() === dayIndex) { 
                const dailyData = await ReadAggregate.find({ userId, date: new Date(date) });
                if (dailyData.length > 0) {
                  weeklyData.push(dailyData[0].dailyReads); // Collect reads for that day
                }
              }
            }
      
            const totalDays = weeklyData.length;
            const totalReads = weeklyData.reduce((total, count) => total + count, 0);
            const averageReads = totalDays > 0 ? totalReads / totalDays : 0;
      
            res.status(200).json({
              averageReads: {
                day: dayIndex,
                value: averageReads // Average reads for the specified day of the week in the current month
              }
            });
          } else {
            res.status(400).json({ error: 'Invalid specificDay parameter. It should be between 0 (Sunday) and 6 (Saturday).' });
          }
        } catch (error) {
          res.status(500).json({ error: 'An error occurred while fetching read data' });
        }
    }
)

exports.getMonthlyReadDataForGraphs = expressAsyncHandler(
  async (req, res) => {
    const { userId, month } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'User Id and month are required' });
    }

    try {
      const today = new Date();
      const currentYear = today.getFullYear();

      const targetMonth = month !== undefined ? Number(month) : today.getMonth();
      
      if (targetMonth < 0 || targetMonth > 11) {
        return res.status(400).json({ error: 'Invalid month parameter. It should be between 0 (January) and 11 (December).' });
      }

      const monthStart = new Date(currentYear, targetMonth, 1); // Start of November
      const monthEnd = new Date(currentYear, targetMonth + 1, 1); // Start of December
      
      console.log('Target Month Start:', monthStart);
      console.log('Target Month End:', monthEnd);

      const monthlyData = await ReadAggregate.find({
        userId,
        date: { $gte: monthStart, $lte: monthEnd }
      });

    //  console.log('Monthly Data', monthlyData);

     // if (monthlyData.length === 0) {
        const daysInMonth = new Date(currentYear, targetMonth + 1, 0).getDate();
        const zeroData = Array.from({ length: daysInMonth }, (v, day) => ({
          date: new Date(currentYear, targetMonth, day + 1).toISOString().slice(0, 10),
          value: 0,
        }));
        
        if (monthlyData.length > 0) {
          monthlyData.forEach(entry => {
            const dayIndex = entry.date.getDate() - 1; 
            zeroData[dayIndex].value = entry.monthlyReads; 
          });
        }
        //res.status(200).json({ monthlyWrites: zeroData });
        return res.status(200).json({ monthlyReads: zeroData });
     // }

      
    } catch (error) {
      console.error('Error fetching monthly read data:', error);
      res.status(500).json({ error: 'An error occurred while fetching read data' });
    }
  }
);


exports.getYearlyReadDataForGraphs = expressAsyncHandler(
  async (req, res) => {
    const { userId, year } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID and year are required" });
    }

    try {
      const today = new Date();
      const currentYear = today.getFullYear();

      const targetYear = year !== undefined ? parseInt(year, 10) : currentYear;

      if (isNaN(targetYear) || targetYear < 2000 || targetYear > currentYear) {
        return res.status(400).json({ error: 'Invalid year parameter. It should be a number between 2000 and the current year.' });
      }

      const yearStart = new Date(targetYear, 0, 1); 
      const yearEnd = new Date(targetYear + 1, 0, 0); // End of the year

      const yearlyData = await ReadAggregate.find({ 
        userId, 
        date: { $gte: yearStart, $lte: yearEnd } 
      });

      // Use an object to hold aggregated values
      const monthlyAggregates = {};

      yearlyData.forEach(entry => {
        const monthKey = entry.date.toISOString().slice(0, 7); // Format YYYY-MM
        if (!monthlyAggregates[monthKey]) {
          monthlyAggregates[monthKey] = 0;
        }
        monthlyAggregates[monthKey] += entry.yearlyReads; 
      });

      const response = [];
      for (let month = 0; month < 12; month++) {
        const monthKey = `${targetYear}-${String(month + 1).padStart(2, '0')}`;
        response.push({
          month: monthKey,
          value: monthlyAggregates[monthKey] || 0 
        });
      }

      res.status(200).json({ yearlyReads: response });
    } catch (error) {
      console.error('Error fetching read data:', error);
      res.status(500).json({ error: 'An error occurred while fetching read data' });
    }
  }
);



exports.getDailyWriteDataForGraphs = expressAsyncHandler(
  async (req, res) => {
     // const { userId } = req.user;
      const { userId, specificDay } = req.query; 
  
      if(!userId || !specificDay){
          res.status(400).json({message:'User Id and day is required'});
      }
    
      try {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date();  //
    
        const dayIndex = parseInt(specificDay, 10); 
        const validDays = [0, 1, 2, 3, 4, 5, 6]; // Sunday to Saturday
    
        if (validDays.includes(dayIndex)) {
          const weeklyData = [];
    
          for (let date = monthStart; date <= monthEnd; date.setDate(date.getDate() + 1)) {
            if (date.getDay() === dayIndex) { 
              const dailyData = await WriteAggregate.find({ userId, date: new Date(date) });
              if (dailyData.length > 0) {
                weeklyData.push(dailyData[0].dailyWrites); // Collect reads for that day
              }
            }
          }
    
          const totalDays = weeklyData.length;
          const totalWrites = weeklyData.reduce((total, count) => total + count, 0);
          const averageWrites = totalDays > 0 ? totalWrites / totalDays : 0;
    
          res.status(200).json({
            averageReads: {
              day: dayIndex,
              value: averageWrites // Average Writes for the specified day of the week in the current month
            }
          });
        } else {
          res.status(400).json({ error: 'Invalid specificDay parameter. It should be between 0 (Sunday) and 6 (Saturday).' });
        }
      } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching read data' });
      }
  }
)

exports.getMonthlyWriteDataForGraphs = expressAsyncHandler(
  async (req, res) => {
    //const { userId } = req.params.userId;
    const { userId, month } = req.query; 
     console.log('User Id', userId);
     console.log('User Month', month);
    if(!userId){
      res.status(400).json({message:'User Id and month is required'});
    }

    try {
      const today = new Date();
      const currentYear = today.getFullYear();

      const targetMonth = month !== undefined ? parseInt(month, 10) : today.getMonth();
      
      if (targetMonth < 0 || targetMonth > 11) {
        return res.status(400).json({ error: 'Invalid month parameter. It should be between 0 (January) and 11 (December).' });
      }

      const monthStart = new Date(currentYear, targetMonth, 1); // Start of November
      const monthEnd = new Date(currentYear, targetMonth + 1, 1); // Start of December
      
      console.log('Target Month Start:', monthStart);
      console.log('Target Month End:', monthEnd);

      const monthlyData = await WriteAggregate.find({ userId, date: { $gte: monthStart, $lte: monthEnd } });

        const daysInMonth = new Date(currentYear, targetMonth + 1, 0).getDate();
        const zeroData = Array.from({ length: daysInMonth }, (i, day) => ({
          date: new Date(currentYear, targetMonth, day + 1).toISOString().slice(0, 10),
          value: 0,
        }));
        
        
        if (monthlyData.length > 0) {
          monthlyData.forEach(entry => {
            const dayIndex = entry.date.getDate() - 1; 
            zeroData[dayIndex].value = entry.monthlyWrites; 
          });
        }
        res.status(200).json({ monthlyWrites: zeroData });
      
    } catch (error) {
      res.status(500).json({ error: 'An error occurred while fetching read data' });
    }
  }
);

exports.getYearlyWriteDataForGraphs = expressAsyncHandler(
async (req, res) => {
 // const userId = req.params.userId; 
  const { userId, year } = req.query; 

  if (!userId) {
    return res.status(400).json({ message: "User ID and year are required" }); 
  }

  try {
    const today = new Date();
    const currentYear = today.getFullYear();

    const targetYear = year !== undefined ? parseInt(year, 10) : currentYear;

    // Validate the year
    if (isNaN(targetYear) || targetYear < 2000 || targetYear > currentYear) {
      return res.status(400).json({ error: 'Invalid year parameter. It should be a number between 2000 and the current year.' });
    }

    const yearStart = new Date(targetYear, 0, 1); 
    const yearEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0); 

    console.log('Year Start:', yearStart);
    console.log('Year End:', yearEnd);

    const yearlyData = await WriteAggregate.find({ 
      userId, 
      date: { $gte: yearStart, $lte: yearEnd } 
    });

     // Initialize an array for all months
     const monthlyWrites = Array.from({ length: 12 }, (_, i) => ({
      month: `${targetYear}-${String(i + 1).padStart(2, '0')}`,
      value: 0
    }));

    // Map the existing data to the monthly array
    yearlyData.forEach(entry => {
      const monthIndex = entry.date.getMonth(); 
      monthlyWrites[monthIndex].value = entry.yearlyWrites; 
    });
    res.status(200).json({
      yearlyWrites: monthlyWrites
    });
  } catch (error) {
    console.error('Error fetching read data:', error); 
    res.status(500).json({ error: 'An error occurred while fetching read data' });
  }
}
);

  
  
  

