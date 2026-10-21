const getHealth = (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "SkillBridge AI server is healthy 💚",
    timestamp: new Date().toISOString(),
    uptime: `${process.uptime().toFixed(0)} seconds`,
  });
};

module.exports = { getHealth };