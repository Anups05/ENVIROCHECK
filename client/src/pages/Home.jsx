import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  HiChartBar, HiShieldCheck, HiLightningBolt, HiGlobe,
  HiArrowRight, HiBeaker, HiSparkles
} from 'react-icons/hi';

const features = [
  {
    icon: HiChartBar,
    title: 'AQI Prediction',
    description: 'AI-powered air quality index prediction using XGBoost machine learning models.',
    color: 'from-blue-500 to-cyan-500',
    shadow: 'shadow-blue-500/20',
  },
  {
    icon: HiShieldCheck,
    title: 'Water Safety',
    description: 'Analyze water quality parameters to determine safety with Random Forest classification.',
    color: 'from-enviro-500 to-teal-500',
    shadow: 'shadow-enviro-500/20',
  },
  {
    icon: HiLightningBolt,
    title: 'Health Risk Assessment',
    description: 'Predict health risk levels using Support Vector Machine models.',
    color: 'from-amber-500 to-orange-500',
    shadow: 'shadow-amber-500/20',
  },
  {
    icon: HiGlobe,
    title: 'Livability Score',
    description: 'Comprehensive environmental livability scoring for any city worldwide.',
    color: 'from-purple-500 to-pink-500',
    shadow: 'shadow-purple-500/20',
  },
];

const stats = [
  { value: '500+', label: 'Cities Analyzed' },
  { value: '99.2%', label: 'Model Accuracy' },
  { value: '10K+', label: 'Reports Generated' },
  { value: '24/7', label: 'Real-time Monitoring' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export default function Home() {
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const heroRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePosition({ x, y });
  };

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section
        ref={heroRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="relative overflow-hidden rounded-3xl min-h-[94vh] flex items-center justify-center cursor-crosshair"
      >
        {/* Base Layer: Clear Image (revealed by the spotlight) */}
        <div className="absolute inset-0">
          <img
            src="/bg-nature.png"
            alt="Nature Background Clear"
            className="w-full h-full object-cover scale-110 opacity-90 transition-transform duration-[20s] hover:scale-125"
          />
        </div>

        {/* Fog and Blur Layer: Uses mask to hide the area around cursor */}
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-all duration-300"
          style={{
            WebkitMaskImage: `radial-gradient(circle ${isHovering ? '300px' : '0px'} at ${mousePosition.x}% ${mousePosition.y}%, transparent 0%, black 100%)`,
            maskImage: `radial-gradient(circle ${isHovering ? '300px' : '0px'} at ${mousePosition.x}% ${mousePosition.y}%, transparent 0%, black 100%)`,
          }}
        >
          {/* Blurred Background */}
          <img
            src="/bg-nature.png"
            alt="Nature Background Blurred"
            className="w-full h-full object-cover blur-[16px] scale-110 opacity-50"
          />
          {/* Fog overlay effect */}
          <div className="absolute inset-0 bg-white/10 backdrop-blur-md mix-blend-overlay"></div>
          {/* Original light gradient down here in the fog layer */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/90 via-white/70 to-white/90"></div>
        </div>

        {/* Global Light overlay ensuring dark text remains readable even when fog is cleared */}
        <div className="absolute inset-0 bg-white/50 pointer-events-none z-0"></div>

        <div className="relative z-10 w-full px-8 py-20 md:py-28 text-center pointer-events-none">
          <div className="pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md rounded-full px-4 py-2 mb-10 border border-white/50 shadow-sm">
                <HiSparkles className="w-4 h-4 text-enviro-600" />
                <span className="text-[#122A1E] text-sm font-medium">AI-Powered Environmental Intelligence</span>
              </div>

              <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-[#122A1E] mb-10 leading-tight">
                EnviroCheck
                <br />
                <span className="text-[#203629]/90 text-3xl md:text-5xl lg:text-5xl font-semibold">
                  Intelligent Assessment of
                </span>
                <br />
                <span className="text-enviro-600">Livability & Environmental Health</span>
              </h1>

              <p className="text-[#203629]/80 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
                Harness the power of machine learning to analyze air quality, water safety,
                and livability metrics for any city. Make informed decisions with real-time environmental data.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/dashboard">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-enviro-600 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-enviro-600/20 hover:shadow-2xl hover:bg-enviro-700 transition-all flex items-center gap-2 mx-auto"
                  >
                    <HiBeaker className="w-5 h-5" />
                    Check Livability
                    <HiArrowRight className="w-5 h-5" />
                  </motion.button>
                </Link>
                <Link to="/compare">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white/60 backdrop-blur-md text-[#122A1E] font-semibold px-8 py-4 rounded-2xl border border-white/50 hover:bg-white/80 transition-all flex items-center gap-2 mx-auto shadow-sm"
                  >
                    Compare Cities
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            variants={itemVariants}
            className="glass-card p-6 text-center"
          >
            <p className="font-display text-3xl md:text-4xl font-bold gradient-text">{stat.value}</p>
            <p className="text-dark-500 text-sm mt-1 font-medium">{stat.label}</p>
          </motion.div>
        ))}
      </motion.section>

      {/* Features */}
      <section>
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-title"
          >
            Powerful <span className="gradient-text">AI Features</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-subtitle mx-auto mt-4"
          >
            Advanced machine learning models analyze environmental data to provide actionable insights
          </motion.p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 gap-6"
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="glass-card-hover p-8 group cursor-pointer"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg ${feature.shadow} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-display text-xl font-bold text-dark-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-dark-500 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="glass-card p-10 md:p-14 text-center relative overflow-hidden">
        <div className="gradient-orb gradient-orb-1"></div>
        <div className="gradient-orb gradient-orb-2"></div>
        <div className="relative z-10">
          <h2 className="section-title mb-4">
            Ready to <span className="gradient-text">Analyze</span>?
          </h2>
          <p className="section-subtitle mx-auto mb-8">
            Start assessing environmental health and livability for your city right now.
          </p>
          <Link to="/dashboard">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-primary text-lg px-10 py-4"
            >
              Get Started <HiArrowRight className="inline w-5 h-5 ml-2" />
            </motion.button>
          </Link>
        </div>
      </section>
    </div>
  );
}
