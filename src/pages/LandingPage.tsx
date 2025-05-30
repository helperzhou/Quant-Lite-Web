import { Button } from 'antd'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import heroImg from '../assets/landing.png'

export default function LandingPage () {
  const navigate = useNavigate()

  return (
    <div className='min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-blue-100 text-center'>
      {/* Animated Image */}
      <motion.img
        src={heroImg}
        alt='Quant Lite'
        className='w-70 h-70 object-cover mb-6'
        animate={{
          y: [0, -10, 0]
        }}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: 'easeInOut'
        }}
      />

      {/* Text Content */}
      <h1 className='text-3xl font-bold text-blue-800 mb-2'>
        Welcome to Quant Lite
      </h1>
      <p className='text-gray-700 text-base max-w-md mb-6'>
        Your #1 SME Helper on the Go — Simplify, track, and grow your business
        wherever you are.
      </p>

      {/* Get Started Button */}
      <Button
        type='primary'
        size='large'
        onClick={() => navigate('/auth/login')}
        className='rounded-full px-10'
      >
        Get Started
      </Button>
    </div>
  )
}
