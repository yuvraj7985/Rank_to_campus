import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import College from '../src/models/College.js';
import Branch from '../src/models/Branch.js';
import Cutoff from '../src/models/Cutoff.js';
import AdmissionRound from '../src/models/AdmissionRound.js';
import Notification from '../src/models/Notification.js';

const adminName = process.env.SEED_ADMIN_NAME?.trim() || '';
const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || '';
const password = process.env.SEED_ADMIN_PASSWORD || '';
if (adminName.length < 2 || adminName.length > 80) {
 throw new Error('Set SEED_ADMIN_NAME to a name between 2 and 80 characters.');
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
 throw new Error('Set SEED_ADMIN_EMAIL to a valid email address.');
}
if (Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) {
 throw new Error('Set SEED_ADMIN_PASSWORD to 8-72 UTF-8 bytes.');
}

await connectDB();
try {
 let admin=await User.findOne({email});
 if(!admin) admin=await User.create({name:adminName,email,password,role:'admin'});
 const existing=await College.countDocuments();
 if(!existing){
  const specs=[
   {name:'North Valley Institute of Technology',code:'NVIT',location:'Delhi NCR',type:'Private',branches:[['Computer Science and Engineering','CSE',120,160000,5000],['Information Technology','IT',90,150000,7500],['Electronics and Communication','ECE',90,145000,11000]]},
   {name:'National Institute of Applied Sciences',code:'NIAS',location:'Uttar Pradesh',type:'Government',branches:[['Computer Science and Engineering','CSE',80,95000,2500],['Mechanical Engineering','ME',100,85000,16000]]},
   {name:'Riverdale University',code:'RU',location:'Haryana',type:'Deemed',branches:[['Computer Science and Engineering','CSE',150,220000,9000],['Artificial Intelligence and Data Science','AIDS',120,210000,10500]]},
   {name:'KIET Group of Institutions',code:'KIET',location:'Ghaziabad, Uttar Pradesh',type:'Private',branches:[['Computer Science and Engineering','CSE',180,175000,2800]]}
  ];
  for(const spec of specs){
   const college=await College.create({name:spec.name,code:spec.code,location:spec.location,type:spec.type});
   for(const [name,code,totalSeats,fees,cutoff] of spec.branches){
    const branch=await Branch.create({college:college._id,name,code,totalSeats,fees});
    for(const category of ['OPEN','EWS','OBC-NCL','SC','ST']){
     const factor={OPEN:1,EWS:1.15,'OBC-NCL':1.25,SC:2.8,ST:3.5}[category];
     await Cutoff.create({branch:branch._id,year:new Date().getFullYear()-1,round:1,category,examName:'JEE Main',openingRank:1,closingRank:Math.round(cutoff*factor)});
    }
   }
  }
 }
 const year=new Date().getFullYear();
 await AdmissionRound.updateOne({name:`Demo Counselling Round ${year}`,year},{ $setOnInsert:{name:`Demo Counselling Round ${year}`,year,status:'open',createdBy:admin._id}},{upsert:true});
 const hasNotifications = await Notification.countDocuments();
 if (!hasNotifications) {
   await Notification.insertMany([
     { title: 'Counselling round is live', message: 'The demo counselling round is now open. Review your choices and submit preferences before the deadline.', audience: 'student', createdBy: admin._id },
     { title: 'Verification reminder', message: 'Please upload identity proof and rank card documents to complete eligibility checks before seat allocation.', audience: 'student', createdBy: admin._id },
     { title: 'System status', message: 'The admission portal is running in demo mode with seeded institution and cutoff data.', audience: 'all', createdBy: admin._id }
   ]);
 }
 console.log('Seed completed. Admin:',email);
} catch(e){console.error(e);process.exitCode=1;} finally{await mongoose.disconnect();}
