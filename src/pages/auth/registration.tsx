import { Button, Divider, Form, Input, message } from 'antd'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import { db, auth } from '../../firebase'
import { doc, setDoc } from 'firebase/firestore'
import logo from '../../assets/3.jpg'

export default function Register () {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const getFirebaseErrorMessage = (code: string): string => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.'
      case 'auth/invalid-email':
        return 'The email address is invalid.'
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.'
      default:
        return 'Something went wrong. Please try again.'
    }
  }

  const handleRegister = async (values: any) => {
    const { userEmail, password, confirmPassword } = values

    if (password !== confirmPassword) {
      setShake(true)
      setTimeout(() => setShake(false), 600)
      return message.error('Passwords do not match.')
    }

    setLoading(true)
    setError(false)

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userEmail,
        password
      )
      const uid = userCredential.user.uid

      // Step 1: Create user doc
      await setDoc(doc(db, 'users', uid), {
        userEmail,
        userRole: 'admin',
        onboarded: false,
        createdAt: new Date()
      })

      message.success('Account created! Let’s complete your profile...')
      setTimeout(() => navigate('/auth/onboarding'), 1000)
    } catch (err: any) {
      setError(true)
      const userMessage = getFirebaseErrorMessage(err.code)
      message.error(userMessage)
    } finally {
      setLoading(false)
    }
  }
  const handleGoogleRegister = async () => {
    const provider = new GoogleAuthProvider()
    setLoading(true)

    try {
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      // Create user doc with UID as doc ID if not already created
      await setDoc(doc(db, 'users', user.uid), {
        userEmail: user.email,
        userRole: 'admin',
        onboarded: false,
        createdAt: new Date()
      })

      message.success(
        'Google sign-in successful! Let’s complete your profile...'
      )
      navigate('/auth/onboarding')
    } catch (err) {
      console.error('Google sign-in error:', err)
      message.error('Google sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='h-screen flex items-center justify-center bg-gradient-to-b from-white to-blue-50 px-4'>
      <div className='relative w-full max-w-md'>
        {/* Floating circular image */}
        <motion.img
          src={logo}
          alt='Quant Lite'
          className='w-24 h-24 object-cover rounded-full border-4 border-white shadow-lg absolute left-1/2 -top-12 -translate-x-1/2 z-10 bg-white'
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        />

        {/* Registration Card */}
        <motion.div
          key={error || shake ? 'shake' : 'normal'}
          initial={{ x: shake ? -10 : 0 }}
          animate={{ x: shake ? [0, -10, 10, -10, 10, 0] : 0 }}
          transition={{ duration: 0.4 }}
          className='bg-white rounded-xl shadow-md pt-16 px-6 pb-8'
        >
          <div className='text-center mb-6'>
            <h2 className='text-3xl font-extrabold text-blue-800 mb-1'>
              Create Your Account
            </h2>
          </div>

          <Form form={form} layout='vertical' onFinish={handleRegister}>
            <Form.Item
              name='userEmail'
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

            <Form.Item
              name='confirmPassword'
              label='Confirm Password'
              rules={[
                { required: true, message: 'Please confirm your password' }
              ]}
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
                {loading ? 'Registering...' : 'Register'}
              </Button>
            </Form.Item>
          </Form>

          <Divider plain>or</Divider>

          <Button
            block
            icon={
              <img
                src='https://www.svgrepo.com/show/475656/google-color.svg'
                alt='google'
                className='w-5 h-5 mr-2'
              />
            }
            onClick={handleGoogleRegister}
          >
            Register with Google
          </Button>

          <p className='text-sm text-center text-gray-600 mt-4'>
            Already have an account?{' '}
            <a
              href='/auth/login'
              className='text-blue-600 font-medium underline'
            >
              Log in
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
