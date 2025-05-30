import { Button, Form, Input, message } from 'antd'
import { motion } from 'framer-motion'
import logo from '../../assets/3.jpg'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../../firebase'
import { useEffect } from 'react'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase' // adjust if needed

const getFirebaseErrorMessage = (code: string): string => {
  switch (code) {
    case 'auth/user-not-found':
      return 'No account found with this email.'
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.'
    case 'auth/invalid-email':
      return 'The email address is badly formatted.'
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Try again later.'
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.'
    default:
      return 'An unexpected error occurred. Please try again.'
  }
}

export default function Login () {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    message.info('This is a test message!')
  }, [])

  const handleLogin = async (values: any) => {
    setLoading(true)
    setError(false)

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        values.email,
        values.password
      )
      const user = userCredential.user

      const userDocRef = doc(db, 'users', user.uid)
      const userDocSnap = await getDoc(userDocRef)

      if (!userDocSnap.exists()) {
        message.error('User record not found.')
        return
      }

      const userData = userDocSnap.data()
      const { userRole, onboarded } = userData

      if (userRole.toLowerCase() !== 'admin') {
        message.success('Login successful!')
        return navigate('/tellers')
      }

      if (!onboarded) {
        message.info('Please complete your profile.')
        return navigate('/auth/onboarding')
      }

      message.success('Welcome back, Admin!')
      navigate('/admin')
    } catch (err: any) {
      setError(true)
      const userMessage = getFirebaseErrorMessage(err.code)
      message.error(userMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4'>
      <div className='relative w-full max-w-md'>
        {/* Floating circular image */}
        <motion.img
          src={logo}
          alt='Quant Lite'
          className='w-24 h-24 object-cover rounded-full border-4 border-white shadow-lg absolute left-1/2 -top-12 -translate-x-1/2 z-10 bg-white'
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        />

        {/* Login card with error animation */}
        <motion.div
          key={error ? 'shake' : 'normal'}
          initial={{ x: error ? -10 : 0 }}
          animate={{ x: error ? [0, -10, 10, -10, 10, 0] : 0 }}
          transition={{ duration: 0.4 }}
          className='bg-white rounded-xl shadow-md pt-16 px-6 pb-8'
        >
          <div className='text-center mb-6'>
            <h2 className='text-3xl font-extrabold text-blue-800 mb-1 font-stretch-50%'>
              Welcome Back
            </h2>
          </div>

          <Form form={form} layout='vertical' onFinish={handleLogin}>
            <Form.Item
              name='email'
              label='Email'
              rules={[{ required: true, message: 'Email is required' }]}
            >
              <Input placeholder='you@example.com' />
            </Form.Item>

            <Form.Item
              name='password'
              label='Password'
              rules={[{ required: true, message: 'Password is required' }]}
            >
              <Input.Password placeholder='••••••••' />
            </Form.Item>

            <Form.Item>
              <Button
                type='primary'
                block
                size='large'
                htmlType='submit'
                loading={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </Form.Item>

            <p className='text-sm text-center text-gray-600 mt-4'>
              Do not have an account?{' '}
              <a
                href='/auth/registration'
                className='text-blue-600 font-medium underline'
              >
                Register
              </a>
            </p>
          </Form>
        </motion.div>
      </div>
    </div>
  )
}
