import { motion } from "motion/react";
import { Music2 } from "lucide-react";

const imgBackground = "/background.jpg";

export default function SplashScreen() {
  return (
    <div
      className="absolute inset-0 bg-center bg-cover bg-no-repeat flex flex-col items-center justify-center"
      style={{
        backgroundImage: `url('${imgBackground}')`,
      }}
    >
      {/* Glassy Card Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
          duration: 0.8,
        }}
        className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-3xl p-12 shadow-2xl max-w-md w-full mx-4"
      >
        {/* Logo with animation */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            duration: 1,
            delay: 0.2,
          }}
          className="mb-8 flex justify-center"
        >
          <div className="relative">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(255,255,255,0.3)",
                  "0 0 40px rgba(255,255,255,0.6)",
                  "0 0 20px rgba(255,255,255,0.3)",
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="bg-white/20 backdrop-blur-lg border border-white/30 rounded-3xl p-8"
            >
              <Music2 className="w-20 h-20 text-white" strokeWidth={1.5} />
            </motion.div>
          </div>
        </motion.div>

        {/* App Name */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-white text-5xl text-center mb-3"
        >
          PLYST
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="text-white/70 text-center mb-10"
        >
          당신의 음악, 당신의 감정
        </motion.p>

        {/* Loading Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="flex justify-center gap-2 mb-8"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
              className="w-3 h-3 bg-white rounded-full"
            />
          ))}
        </motion.div>

        {/* Loading Text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-white/60 text-center text-sm"
        >
          로딩 중...
        </motion.p>
      </motion.div>

    </div>
  );
}