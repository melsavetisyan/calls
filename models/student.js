import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
    id: Number,
    uid: Number,
    phone: String,
    username: String,
    name: String,
    first_name: String,
    last_name: String,
    email: String,
    birthyear: String,
    callers : {
      type: [String]
    },
    rates: {
      math: { type: String, default: null },
      rus: { type: String, default: null },
      biology: { type: String, default: null },
      chemistry: { type: String, default: null },
      english: { type: String, default: null },
      history: { type: String, default: null },
      language: { type: String, default: null }
    },

    subjects:{
        type: [String],
        enum: ['մաթեմատիկա','ռուսերեն','կենսաբանություն','քիմիա','անգլերեն','հայոց պատմություն','հայոց լեզու']
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'noAnswer', "inProgress", 'wrong'],
      default: 'pending'
    }
  }, {
    collection: 'all_users',
    timestamps: true
});

export default studentSchema.index({ uid: 1 }, { unique: true });