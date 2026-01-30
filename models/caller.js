import mongoose from 'mongoose';

const callerScema = new mongoose.Schema({
    id: String,
    name: String,
    username: String,
    status: {
      type: Boolean,
      default: false
    },
    callCount:{
        type: Object,
        default: {
            summary: 0,
            confirmed: 0,
            cancelled: 0,
            noAnswer: 0 
       }
    },
  }, {
    collection: 'callers',
    timestamps: true
});

export default callerScema.index({ id: 1 }, { unique: true });