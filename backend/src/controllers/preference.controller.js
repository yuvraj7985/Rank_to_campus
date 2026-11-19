import Student from '../models/Student.js';
import AdmissionRound from '../models/AdmissionRound.js';
import Preference from '../models/Preference.js';
import Branch from '../models/Branch.js';
import {asyncHandler} from '../utils/asyncHandler.js';
export const savePreferences=asyncHandler(async(req,res)=>{
 const {admissionRound,choices}=req.body;
 if(!Array.isArray(choices)||choices.length===0)return res.status(400).json({success:false,message:'Add at least one choice.'});
 const round=await AdmissionRound.findById(admissionRound);
 if(!round||round.status!=='open')return res.status(400).json({success:false,message:'This admission round is not open.'});
 const unique=[...new Set(choices.map(c=>String(c.branch)))];
 if(unique.length!==choices.length)return res.status(400).json({success:false,message:'Duplicate branch choices are not allowed.'});
 const valid=await Branch.countDocuments({_id:{$in:unique},isActive:true});
 if(valid!==unique.length)return res.status(400).json({success:false,message:'One or more branches are invalid.'});
 const student=await Student.findOne({user:req.user._id});
 const existing=await Preference.findOne({student:student._id,admissionRound});
 if(existing?.isLocked)return res.status(409).json({success:false,message:'Preferences are locked and cannot be edited.'});
 const formatted=choices.map((c,i)=>({branch:c.branch,order:i+1}));
 const preference=await Preference.findOneAndUpdate({student:student._id,admissionRound},{choices:formatted},{new:true,upsert:true,runValidators:true});
 res.json({success:true,data:preference});
});
export const lockPreferences=asyncHandler(async(req,res)=>{
 const student=await Student.findOne({user:req.user._id});
 if(!student)return res.status(404).json({success:false,message:'Student profile not found.'});
 const round=await AdmissionRound.findById(req.params.roundId);
 if(!round||round.status!=='open')return res.status(400).json({success:false,message:'This admission round is not open for locking.'});
 const pref=await Preference.findOne({student:student._id,admissionRound:req.params.roundId});
 if(!pref||!pref.choices.length)return res.status(404).json({success:false,message:'Save preferences before locking.'});
 pref.isLocked=true;pref.lockedAt=new Date();await pref.save();
 res.json({success:true,message:'Preferences locked successfully.',data:pref});
});
export const getMyPreferences=asyncHandler(async(req,res)=>{
 const student=await Student.findOne({user:req.user._id});
 res.json({success:true,data:await Preference.find({student:student._id}).populate({path:'choices.branch',populate:{path:'college'}})});
});
