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
  Modal,
  message as antdMessage
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
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
  const [modalVisible, setModalVisible] = useState(false)
  const [branches, setBranches] = useState<string[]>([])
  const [tellers, setTellers] = useState<string[]>([])
  const [filters, setFilters] = useState<{
    branch?: string
    dateRange?: [Dayjs, Dayjs]
    teller?: string
  }>({ dateRange: [dayjs().startOf('month'), dayjs().endOf('month')] })

  // Fetch branches and tellers for filters
  useEffect(() => {
    async function fetchMeta () {
      if (!companyName) return
      const salesQ = query(
        collection(db, 'sales'),
        where('companyName', '==', companyName)
      )
      const salesSnap = await getDocs(salesQ)
      const branchSet = new Set<string>()
      const tellerSet = new Set<string>()
      salesSnap.forEach(doc => {
        const d = doc.data()
        if (d.branch) branchSet.add(d.branch)
        if (d.tellerName) tellerSet.add(d.tellerName)
      })
      setBranches(Array.from(branchSet))
      setTellers(Array.from(tellerSet))
    }
    fetchMeta()
  }, [companyName])

  // Fetch expenses for this company + filters
  useEffect(() => {
    async function fetchExpenses () {
      if (!companyName) return
      setFetching(true)
      try {
        let qFilters: any[] = [where('companyName', '==', companyName)]
        if (filters.branch) qFilters.push(where('branch', '==', filters.branch))
        if (filters.teller)
          qFilters.push(where('tellerName', '==', filters.teller))
        // Filter by date
        if (filters.dateRange && filters.dateRange.length === 2) {
          qFilters.push(
            where(
              'date',
              '>=',
              Timestamp.fromDate(filters.dateRange[0].toDate())
            ),
            where(
              'date',
              '<=',
              Timestamp.fromDate(filters.dateRange[1].toDate())
            )
          )
        }
        const qExp = query(
          collection(db, 'expenses'),
          ...qFilters,
          orderBy('date', 'desc')
        )
        const snap = await getDocs(qExp)
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
  }, [companyName, filters, loading])

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
        branch: filters.branch || currentUser?.branch || '',
        tellerName: currentUser?.name || '',
        date: values.date
          ? Timestamp.fromDate(values.date.toDate())
          : Timestamp.now(),
        createdAt: Timestamp.now()
      }
      await addDoc(collection(db, 'expenses'), entry)
      messageApi.success('Expense captured!')
      form.resetFields()
      form.setFieldValue('date', dayjs())
      setModalVisible(false)
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

  // Table columns for desktop view
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
    { title: 'Branch', dataIndex: 'branch', key: 'branch' },
    { title: 'Teller', dataIndex: 'tellerName', key: 'tellerName' },
    { title: 'Description', dataIndex: 'description', key: 'description' }
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 12 }}>
      {contextHolder}

      {/* FILTERS ROW */}
      <Card
        title='Expense Filters'
        size='small'
        style={{
          marginBottom: 18,
          background: '#f7f9fc',
          borderRadius: 8
        }}
        bodyStyle={{ padding: screens.md ? '12px 24px' : '8px' }}
      >
        <Row gutter={[8, 8]} align='middle'>
          <Col xs={24} md={8}>
            <Select
              allowClear
              value={filters.branch}
              onChange={branch =>
                setFilters(f => ({ ...f, branch: branch || undefined }))
              }
              placeholder='Branch'
              style={{ width: '100%' }}
            >
              {branches.map(branch => (
                <Select.Option key={branch} value={branch}>
                  {branch}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <Select
              allowClear
              value={filters.teller}
              onChange={teller =>
                setFilters(f => ({ ...f, teller: teller || undefined }))
              }
              placeholder='Teller'
              style={{ width: '100%' }}
            >
              {tellers.map(teller => (
                <Select.Option key={teller} value={teller}>
                  {teller}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <DatePicker.RangePicker
              allowClear={false}
              style={{ width: '100%' }}
              value={filters.dateRange}
              onChange={dates =>
                setFilters(f => ({ ...f, dateRange: dates as [Dayjs, Dayjs] }))
              }
            />
          </Col>
        </Row>
        <Row justify='end' style={{ marginTop: 12 }}>
          <Button
            icon={<PlusOutlined />}
            type='primary'
            onClick={() => setModalVisible(true)}
          >
            Add New
          </Button>
        </Row>
      </Card>

      {/* EXPENSE TABLE/LIST */}
      <Card title='Recent Expenses' style={{ marginBottom: 24 }}>
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
                  {exp.branch && (
                    <Col style={{ fontSize: 13, color: '#444' }}>
                      Branch: {exp.branch}
                    </Col>
                  )}
                  {exp.tellerName && (
                    <Col style={{ fontSize: 13, color: '#444' }}>
                      Teller: {exp.tellerName}
                    </Col>
                  )}
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

      {/* ADD/EDIT EXPENSE MODAL */}
      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        title='Add Expense'
        footer={null}
        destroyOnClose
      >
        <div ref={formWrapperRef} className='expense-form-wrapper'>
          <Form
            form={form}
            layout='vertical'
            onFinish={handleFinish}
            onFinishFailed={handleFinishFailed}
            initialValues={{
              date: dayjs(),
              branch: filters.branch || currentUser?.branch || '',
              tellerName: currentUser?.name || ''
            }}
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
            <Form.Item
              name='branch'
              label='Branch'
              rules={[{ required: true, message: 'Branch required' }]}
              initialValue={filters.branch || currentUser?.branch || ''}
            >
              <Select allowClear placeholder='Branch'>
                {branches.map(b => (
                  <Select.Option key={b} value={b}>
                    {b}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name='tellerName'
              label='Teller'
              rules={[{ required: true, message: 'Teller required' }]}
              initialValue={currentUser?.name || ''}
            >
              <Select
                allowClear
                placeholder='Teller'
                showSearch
                optionFilterProp='children'
                disabled={true}
              >
                {tellers.map(t => (
                  <Select.Option key={t} value={t}>
                    {t}
                  </Select.Option>
                ))}
                <Select.Option
                  key={currentUser?.name}
                  value={currentUser?.name}
                >
                  {currentUser?.name}
                </Select.Option>
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
                  initialValue={dayjs()}
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
      </Modal>
    </div>
  )
}
