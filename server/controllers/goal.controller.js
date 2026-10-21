const CareerGoal = require('../models/CareerGoal');
const AppError = require('../utils/AppError');

const list = async (req, res) => {
  const items = await CareerGoal.find({ user: req.user._id }).sort({ status: 1, updatedAt: -1 });
  res.json({ success: true, data: { items } });
};

// Creating a new active goal pauses the previous active one, so there is
// always a single "current" target role.
const create = async (req, res) => {
  await CareerGoal.updateMany({ user: req.user._id, status: 'active' }, { status: 'paused' });
  const goal = await CareerGoal.create({ ...req.valid.body, user: req.user._id });
  res.status(201).json({ success: true, message: 'Goal saved.', data: { goal } });
};

const update = async (req, res) => {
  const goal = await CareerGoal.findOne({ _id: req.valid.params.id, user: req.user._id });
  if (!goal) throw AppError.notFound('Goal not found.');
  if (req.valid.body.status === 'active' && goal.status !== 'active') {
    await CareerGoal.updateMany({ user: req.user._id, status: 'active' }, { status: 'paused' });
  }
  Object.assign(goal, req.valid.body);
  await goal.save();
  res.json({ success: true, message: 'Goal updated.', data: { goal } });
};

const remove = async (req, res) => {
  const { deletedCount } = await CareerGoal.deleteOne({ _id: req.valid.params.id, user: req.user._id });
  if (!deletedCount) throw AppError.notFound('Goal not found.');
  res.json({ success: true, message: 'Goal deleted.' });
};

module.exports = { list, create, update, remove };
