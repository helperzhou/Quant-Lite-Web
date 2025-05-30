import React, { useState, useEffect, useRef } from 'react'
import {
  Card,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  Select,
  Row,
  Col,
  Table,
  Grid,
  Spin,
  Empty,
  message as antdMessage
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useOutletContext } from 'react-router-dom'

const expenseCategories = [
  'Fuel',
  'Salary',
  'Equipment Hire',
  'Wage',
  'Rent',
  'Subscription'
]

const useBreakpoint = Grid.useBreakpoint

export default function ExpenseCaptureList () {
  const { currentUser } = useOutletContext<any>()
  const companyName = currentUser?.companyName || ''
  const [form] = Form.useForm()
  const [messageApi, contextHolder] = antdMessage.useMessage()
  const [loading, setLoading] = useState(false)
  const [expenses, setExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState(expenseCategories)
  const [fetching, setFetching] = useState(true)
  const screens = useBreakpoint()
  const formWrapperRef = useRef<HTMLDivElement>(null)

  // Fetch expenses for this company
  useEffect(() => {
    async function fetchExpenses () {
      if (!companyName) return
      setFetching(true)
      try {
        const q = query(
          collection(db, 'expenses'),
          where('companyName', '==', companyName),
          orderBy('date', 'desc')
        )
        const snap = await getDocs(q)
        setExpenses(
          snap.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          }))
        )
      } catch (err) {
        console.log(err)
        messageApi.error('Could not fetch expenses')
      }
      setFetching(false)
    }
    fetchExpenses()
  }, [companyName, loading])

  // Add custom category
  const handleCategoryChange = (value: string) => {
    if (!categories.includes(value) && value.trim()) {
      setCategories([value, ...categories])
    }
  }

  // Animate form shake on error
  const triggerFormShake = () => {
    if (!formWrapperRef.current) return
    formWrapperRef.current.classList.remove('shake')
    // Force reflow
    // @ts-ignore
    void formWrapperRef.current.offsetWidth
    formWrapperRef.current.classList.add('shake')
  }

  // Save expense
  const handleFinish = async (values: any) => {
    setLoading(true)
    try {
      const entry = {
        ...values,
        companyName,
        date: values.date
          ? Timestamp.fromDate(values.date.toDate())
          : Timestamp.now(),
        createdAt: Timestamp.now()
      }
      await addDoc(collection(db, 'expenses'), entry)
      messageApi.success('Expense captured!')
      form.resetFields()
      form.setFieldValue('date', dayjs())
      setLoading(false)
    } catch (e) {
      messageApi.error('Could not save expense.')
      triggerFormShake()
      setLoading(false)
    }
  }

  // Validation failure handler (shakes)
  const handleFinishFailed = (err: any) => {
    triggerFormShake()
    messageApi.error('Please fix form errors before saving.')
  }

  // AntD Table columns for desktop view
  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (d: any) =>
        d?.seconds ? dayjs.unix(d.seconds).format('YYYY-MM-DD') : ''
    },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amt: number) => `R${amt}`
    },
    { title: 'Description', dataIndex: 'description', key: 'description' }
  ]

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 12 }}>
      {contextHolder}
      <Card title='Capture Expense' style={{ marginBottom: 24 }}>
        <div ref={formWrapperRef} className='expense-form-wrapper'>
          <Form
            form={form}
            layout='vertical'
            onFinish={handleFinish}
            onFinishFailed={handleFinishFailed}
            initialValues={{ date: dayjs() }}
          >
            <Form.Item
              name='type'
              label='Expense Type'
              rules={[
                { required: true, message: 'Select or enter expense type' }
              ]}
            >
              <Select
                showSearch
                placeholder='Select or enter category'
                onChange={handleCategoryChange}
                dropdownRender={menu => (
                  <>
                    {menu}
                    <div style={{ display: 'flex', gap: 8, padding: 8 }}>
                      <Input
                        placeholder='Add new category'
                        onPressEnter={e => {
                          const val = (e.target as HTMLInputElement).value
                          if (val && !categories.includes(val)) {
                            setCategories([val, ...categories])
                            form.setFieldValue('type', val)
                          }
                        }}
                      />
                    </div>
                  </>
                )}
              >
                {categories.map(cat => (
                  <Select.Option key={cat} value={cat}>
                    {cat}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Row gutter={12}>
              <Col span={14}>
                <Form.Item
                  name='amount'
                  label='Amount'
                  rules={[{ required: true, message: 'Enter amount' }]}
                >
                  <InputNumber
                    min={0}
                    prefix='R'
                    style={{ width: '100%' }}
                    placeholder='0.00'
                  />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item
                  name='date'
                  label='Date'
                  rules={[{ required: true, message: 'Pick date' }]}
                >
                  <DatePicker style={{ width: '100%' }} format='YYYY-MM-DD' />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name='description' label='Description (optional)'>
              <Input.TextArea rows={2} placeholder='Extra details, if any...' />
            </Form.Item>
            <Button
              type='primary'
              htmlType='submit'
              loading={loading}
              block
              size='large'
              icon={<PlusOutlined />}
            >
              Save Expense
            </Button>
          </Form>
        </div>
      </Card>

      {/* Expense List/Table */}
      <Card title='Recent Expenses'>
        {fetching ? (
          <Spin />
        ) : expenses.length === 0 ? (
          <Empty description='No expenses found.' />
        ) : screens.md ? (
          <Table
            columns={columns}
            dataSource={expenses}
            rowKey='id'
            pagination={{ pageSize: 8 }}
          />
        ) : (
          <div style={{ maxHeight: 330, overflowY: 'auto', paddingRight: 4 }}>
            {expenses.map(exp => (
              <Card
                key={exp.id}
                size='small'
                style={{ marginBottom: 8 }}
                bodyStyle={{ padding: 12 }}
              >
                <Row justify='space-between'>
                  <Col>
                    <b>{exp.type}</b>
                  </Col>
                  <Col>
                    <span style={{ color: '#4F8EF7' }}>
                      {exp.date?.seconds
                        ? dayjs.unix(exp.date.seconds).format('YYYY-MM-DD')
                        : ''}
                    </span>
                  </Col>
                </Row>
                <Row>
                  <Col flex='auto'>
                    <span style={{ fontWeight: 500, color: '#222' }}>
                      R{exp.amount}
                    </span>
                  </Col>
                  {exp.description && (
                    <Col span={24} style={{ color: '#888', fontSize: 13 }}>
                      {exp.description}
                    </Col>
                  )}
                </Row>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
