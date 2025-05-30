import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  message
} from 'antd'
import { useEffect, useState } from 'react'
import { auth, db } from '../../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

export default function Onboarding () {
  const [messageApi, contextHolder] = message.useMessage()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [uid, setUid] = useState<string | null>(null)
  const [branchCount, setBranchCount] = useState<number>(1)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setUid(user.uid)
      } else {
        navigate('/auth/login')
      }
    })
    return () => unsubscribe()
  }, [navigate])

  const handleFinish = async (values: any) => {
    if (!uid) return

    const { companyName, phone, branch1, branch2, workers, turnover } = values
    const branches = [branch1, branch2].filter(Boolean)

    setLoading(true)

    try {
      await updateDoc(doc(db, 'users', uid), {
        companyName,
        phone,
        branches,
        workers,
        turnover,
        onboarded: true
      })
      messageApi.success('Profile completed successfully!')
      navigate('/admin')
    } catch (err) {
      console.error(err)
      messageApi.error('Failed to save your information. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {contextHolder}
      <div className='min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-white to-blue-50'>
        <div className='w-full max-w-md bg-white rounded-xl shadow-lg p-6'>
          <h2 className='text-xl font-bold text-center mb-4 text-blue-800'>
            Complete Your Profile
          </h2>

          <Form form={form} layout='vertical' onFinish={handleFinish}>
            <Form.Item
              name='companyName'
              label='Company Name'
              rules={[{ required: true, message: 'Company name is required' }]}
            >
              <Input placeholder='Quantilytix' />
            </Form.Item>
            <Form.Item
              name='phone'
              label='Phone Number'
              rules={[{ required: true, message: 'Phone is required' }]}
            >
              <Input placeholder='+27...' />
            </Form.Item>

            <Form.Item label='How many branches do you have?'>
              <Radio.Group
                value={branchCount}
                onChange={e => setBranchCount(e.target.value)}
              >
                <Radio value={1}>One</Radio>
                <Radio value={2}>Two</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name='branch1'
              label='Branch 1'
              rules={[
                { required: true, message: 'At least one branch is required' }
              ]}
            >
              <Input placeholder='e.g., Harare Branch' />
            </Form.Item>

            {branchCount === 2 && (
              <Form.Item
                name='branch2'
                label='Branch 2'
                rules={[
                  { required: true, message: 'Please enter second branch' }
                ]}
              >
                <Input placeholder='e.g., Bulawayo Branch' />
              </Form.Item>
            )}

            <Row gutter={16} wrap={false}>
              <Col xs={12} sm={12}>
                <Form.Item
                  name='workers'
                  label='Number of Workers'
                  rules={[
                    {
                      required: true,
                      message: 'Please enter number of workers'
                    }
                  ]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} sm={12}>
                <Form.Item
                  name='turnover'
                  label='Monthly Turnover'
                  rules={[{ required: true, message: 'Please enter turnover' }]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} prefix='R' />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Button type='primary' block htmlType='submit' loading={loading}>
                Complete Profile
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </>
  )
}
