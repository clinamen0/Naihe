import { motion } from "framer-motion";

const appear = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.2 } },
};

export default function Gateway({ value, onChange, failed, onSubmit, _ }) {
  return (
    <motion.div className="view gateway" {...appear}>
      <div className="gw-logo">NH</div>
      <div className="gw-brand">{_("gateway.brand")}</div>
      <div className="gw-tagline">{_("gateway.tagline")}</div>
      <input
        className="gw-field"
        type="password"
        placeholder={_("gateway.placeholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        autoFocus
      />
      {failed && (
        <motion.div
          className="gw-denied"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {_("gateway.denied")}
        </motion.div>
      )}
      <div className="gw-wish">{_("gateway.wish")}</div>
    </motion.div>
  );
}
