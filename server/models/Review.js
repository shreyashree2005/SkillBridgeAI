const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// A learner's review of a mentor after a completed session.
const reviewSchema = new mongoose.Schema(
  {
    reviewer: { type: ObjectId, ref: 'User', required: true },
    subject: { type: ObjectId, ref: 'User', required: true, index: true }, // the mentor
    session: { type: ObjectId, ref: 'MentorSession', required: true, unique: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Recompute the mentor's average rating from all of their reviews.
reviewSchema.statics.recomputeFor = async function recomputeFor(userId) {
  const [agg] = await this.aggregate([
    { $match: { subject: new mongoose.Types.ObjectId(String(userId)) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await mongoose.model('User').updateOne(
    { _id: userId },
    { ratingAverage: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg ? agg.count : 0 }
  );
};

module.exports = mongoose.model('Review', reviewSchema);
