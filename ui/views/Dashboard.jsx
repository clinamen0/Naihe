import { motion } from "framer-motion";

const container = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const card = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function Dashboard({ onRoom, onCipher, _ }) {
  return (
    <motion.div className="view dashboard" variants={container} initial="initial" animate="animate">
      <motion.div className="dash-header" variants={card}>
        {_("dashboard.header")}
      </motion.div>
      <motion.div className="dash-sub" variants={card}>
        {_("dashboard.sub")}
      </motion.div>
      <div className="dash-grid">
        <motion.div
          className="dash-card"
          variants={card}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRoom}
        >
          <div className="dash-card-icon">&#9881;</div>
          <div className="dash-card-title">{_("dashboard.room.title")}</div>
          <div className="dash-card-info">{_("dashboard.room.info")}</div>
        </motion.div>
        <motion.div
          className="dash-card"
          variants={card}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCipher}
        >
          <div className="dash-card-icon">&#128274;</div>
          <div className="dash-card-title">{_("dashboard.cipher.title")}</div>
          <div className="dash-card-info">{_("dashboard.cipher.info")}</div>
        </motion.div>
      </div>
    </motion.div>
  );
}
