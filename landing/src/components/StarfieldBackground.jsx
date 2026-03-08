import { useState, useEffect } from 'react'

export default function StarfieldBackground() {
  const [stars, setStars] = useState([])
  const [shootingStars, setShootingStars] = useState([])
  const [scrollY, setScrollY] = useState(0)

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Generate stars on mount
  useEffect(() => {
    const generatedStars = []
    // Layer 1: Small distant stars (slowest parallax)
    for (let i = 0; i < 150; i++) {
      generatedStars.push({
        id: `s1-${i}`,
        x: Math.random() * 100,
        y: Math.random() * 200,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 5,
        layer: 1,
        parallaxSpeed: 0.02
      })
    }
    // Layer 2: Medium stars (medium parallax)
    for (let i = 0; i < 80; i++) {
      generatedStars.push({
        id: `s2-${i}`,
        x: Math.random() * 100,
        y: Math.random() * 200,
        size: Math.random() * 2 + 1.5,
        opacity: Math.random() * 0.4 + 0.4,
        duration: Math.random() * 4 + 3,
        delay: Math.random() * 5,
        layer: 2,
        parallaxSpeed: 0.05
      })
    }
    // Layer 3: Bright stars (fastest parallax - closest)
    for (let i = 0; i < 30; i++) {
      generatedStars.push({
        id: `s3-${i}`,
        x: Math.random() * 100,
        y: Math.random() * 200,
        size: Math.random() * 2.5 + 2,
        opacity: Math.random() * 0.3 + 0.7,
        duration: Math.random() * 2 + 1,
        delay: Math.random() * 3,
        layer: 3,
        parallaxSpeed: 0.1,
        color: ['#ffffff', '#00f5ff', '#bf00ff', '#ffd700'][Math.floor(Math.random() * 4)]
      })
    }
    setStars(generatedStars)
  }, [])

  // Shooting stars
  useEffect(() => {
    const createShootingStar = () => {
      const id = Date.now()
      const star = {
        id,
        x: Math.random() * 70 + 10,
        y: Math.random() * 30,
        duration: Math.random() * 1 + 0.5
      }
      setShootingStars(prev => [...prev, star])
      setTimeout(() => {
        setShootingStars(prev => prev.filter(s => s.id !== id))
      }, star.duration * 1000 + 500)
    }

    const interval = setInterval(() => {
      if (Math.random() > 0.6) createShootingStar()
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Deep space gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-dark-950 via-[#0a0a1a] to-dark-950" />

      {/* Nebula effects with parallax */}
      <div
        className="absolute left-1/4 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[120px] animate-pulse"
        style={{
          animationDuration: '8s',
          top: `calc(0% - ${scrollY * 0.03}px)`
        }}
      />
      <div
        className="absolute right-0 w-[500px] h-[500px] bg-cyan-900/10 rounded-full blur-[100px] animate-pulse"
        style={{
          animationDuration: '10s',
          animationDelay: '2s',
          top: `calc(33% - ${scrollY * 0.04}px)`
        }}
      />
      <div
        className="absolute left-0 w-[400px] h-[400px] bg-blue-900/10 rounded-full blur-[80px] animate-pulse"
        style={{
          animationDuration: '12s',
          animationDelay: '4s',
          bottom: `calc(0% + ${scrollY * 0.02}px)`
        }}
      />

      {/* Stars with parallax */}
      {stars.map(star => {
        const parallaxOffset = scrollY * star.parallaxSpeed
        return (
          <div
            key={star.id}
            className="absolute rounded-full animate-twinkle"
            style={{
              left: `${star.x}%`,
              top: `calc(${star.y}% - ${parallaxOffset}px)`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: star.color || '#ffffff',
              opacity: star.opacity,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
              boxShadow: star.layer === 3 ? `0 0 ${star.size * 2}px ${star.color || '#ffffff'}` : 'none',
              willChange: 'top'
            }}
          />
        )
      })}

      {/* Shooting stars */}
      {shootingStars.map(star => (
        <div
          key={star.id}
          className="absolute animate-shooting-star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            animationDuration: `${star.duration}s`
          }}
        >
          <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_6px_#fff,_-30px_0_20px_rgba(255,255,255,0.3),_-60px_0_30px_rgba(255,255,255,0.1)]"
               style={{ transform: 'rotate(-45deg)' }} />
        </div>
      ))}

      {/* Grid overlay (subtle) */}
      <div className="absolute inset-0 bg-grid-pattern bg-[size:60px_60px] opacity-[0.03]" />
    </div>
  )
}
