import { useEffect, useState } from 'react'
import {
  Tabs,
  List,
  Button,
  Drawer,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Card,
  Modal,
  Table,
  DatePicker,
  Tag,
  Select,
  Empty
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '../../../firebase'
import { useMediaQuery } from 'react-responsive'
import dayjs from 'dayjs'
import { useOutletContext } from 'react-router-dom'
import type { Teller } from '../../../types/type'

const TellersPage = () => {
  const [messageApi, contextHolder] = message.useMessage()
  const { currentUser } = useOutletContext()
  const [tellers, setTellers] = useState<Teller[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [editingTeller, setEditingTeller] = useState<Teller | null>(null)
  const isMobile = useMediaQuery({ maxWidth: 767 })
  const [search, setSearch] = useState('')
  const [tabKey, setTabKey] = useState('list')
  const [selectedDate, setSelectedDate] = useState(dayjs())
  const [cashIns, setCashIns] = useState<any[]>([])
  const [cashInExpectations, setCashInExpectations] = useState<
    Record<string, number>
  >({})
  // Get available branches for Select
  const branches = currentUser?.branches || []

  useEffect(() => {
    if (!currentUser?.companyName) return

    const q = query(
      collection(db, 'users'),
      where('userRole', '==', 'teller'),
      where('companyName', '==', currentUser.companyName)
    )

    const unsub = onSnapshot(
      q,
      snapshot => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setTellers(data)
        setLoading(false)
      },
      err => {
        messageApi.error('Failed to fetch tellers')
        setLoading(false)
      }
    )
    return () => unsub()
  }, [currentUser?.companyName])

  useEffect(() => {
    const fetchExpectations = async () => {
      const q = query(
        collection(db, 'cashInExpectations'),
        where('date', '==', selectedDate.format('YYYY-MM-DD'))
      )
      const snap = await getDocs(q)
      const obj = {}
      snap.forEach(doc => {
        obj[doc.data().branch] = doc.data().expected
      })
      setCashInExpectations(obj)
    }
    fetchExpectations()
  }, [selectedDate])

  useEffect(() => {
    const fetchCashIns = async () => {
      const q = query(
        collection(db, 'cashIns'),
        where('date', '==', selectedDate.format('YYYY-MM-DD'))
      )
      const snap = await getDocs(q)
      setCashIns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    }
    fetchCashIns()
  }, [selectedDate])

  const handleDelete = async id => {
    try {
      await deleteDoc(doc(db, 'users', id))
      messageApi.success('Teller deleted')
    } catch (err: any) {
      messageApi.error('Failed to delete teller')
    }
  }

  const openForm = (record: Teller | null = null) => {
    form.resetFields()
    if (record) {
      setEditingTeller(record)
      setTimeout(() => {
        form.setFieldsValue(record)
      }, 0)
    } else {
      setEditingTeller(null)
    }
    if (isMobile) {
      setDrawerVisible(true)
    } else {
      setModalVisible(true)
    }
  }

  const handleSave = async (values: any) => {
    try {
      if (editingTeller) {
        await updateDoc(doc(db, 'users', editingTeller.id), {
          ...values,
          userRole: 'teller'
        })
        messageApi.success('Teller updated')
      } else {
        const cred = await createUserWithEmailAndPassword(
          auth,
          values.email,
          values.password
        )
        await setDoc(doc(db, 'users', cred.user.uid), {
          ...values,
          userRole: 'teller',
          uid: cred.user.uid,
          companyName: currentUser.companyName,
          branches: [values.branch], // Save as array for consistency
          branch: values.branch, // Redundant but makes it easier to query
          beneficiaryName: currentUser.beneficiaryName || '',
          workers: currentUser.workers || 0,
          monthlyTurnover: currentUser.monthlyTurnover || 0
        })
        messageApi.success(`Teller created with password: ${values.password}`)
      }
      setDrawerVisible(false)
      setModalVisible(false)
    } catch (err: any) {
      messageApi.error('Error saving teller')
    }
  }

  const filteredTellers = tellers.filter(
    teller =>
      teller.name.toLowerCase().includes(search.toLowerCase()) ||
      teller.email.toLowerCase().includes(search.toLowerCase())
  )

  const renderForm = () => (
    <Form
      form={form}
      layout='vertical'
      onFinish={handleSave}
      initialValues={{
        name: '',
        email: '',
        phone: '',
        password: '',
        branch: branches[0] || ''
      }}
    >
      <Form.Item name='name' label='Name' rules={[{ required: true }]}>
        <Input placeholder='Jane Doe' />
      </Form.Item>
      <Form.Item
        name='branch'
        label='Branch'
        rules={[{ required: true, message: 'Branch is required' }]}
      >
        <Select placeholder='Select branch'>
          {branches.map(b => (
            <Select.Option value={b} key={b}>
              {b}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        name='email'
        label='Email'
        rules={[{ required: true, type: 'email' }]}
      >
        <Input placeholder='email@example.com' disabled={!!editingTeller} />
      </Form.Item>
      <Form.Item name='phone' label='Phone'>
        <Input placeholder='+263...' />
      </Form.Item>
      {!editingTeller && (
        <Form.Item
          name='password'
          label='Password'
          rules={[{ required: true, message: 'Password is required' }]}
        >
          <Input.Password placeholder='••••••••' />
        </Form.Item>
      )}
      <Form.Item>
        <Button type='primary' htmlType='submit' block>
          {editingTeller ? 'Update' : 'Create'}
        </Button>
      </Form.Item>
    </Form>
  )

  return (
    <>
      {contextHolder}{' '}
      <div className='bg-white p-4 rounded-lg shadow-sm'>
        <Tabs activeKey={tabKey} onChange={key => setTabKey(key)}>
          <Tabs.TabPane tab='Tellers List' key='list'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-semibold'>Teller Users</h2>
              <Button
                type='primary'
                icon={<PlusOutlined />}
                onClick={() => openForm(null)}
              >
                Add Teller
              </Button>
            </div>
            <Input.Search
              placeholder='Search teller by name or email'
              value={search}
              onChange={e => setSearch(e.target.value)}
              className='mb-4'
              allowClear
            />

            {isMobile ? (
              <Space direction='vertical' style={{ width: '100%' }}>
                {filteredTellers.map(teller => (
                  <Card
                    key={teller.id}
                    title={teller.name}
                    size='small'
                    extra={
                      <Space>
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => openForm(teller)}
                        />
                        <Popconfirm
                          title='Delete teller?'
                          onConfirm={() => handleDelete(teller.id)}
                          okText='Yes'
                          cancelText='No'
                        >
                          <Button icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                      </Space>
                    }
                  >
                    <p>Email: {teller.email}</p>
                    <p>Phone: {teller.phone}</p>
                    <p>
                      Branch: <Tag>{teller.branch}</Tag>
                    </p>
                  </Card>
                ))}
              </Space>
            ) : (
              <Table
                columns={[
                  { title: 'Name', dataIndex: 'name', key: 'name' },
                  { title: 'Email', dataIndex: 'email', key: 'email' },
                  { title: 'Phone', dataIndex: 'phone', key: 'phone' },
                  {
                    title: 'Branch',
                    dataIndex: 'branch',
                    key: 'branch',
                    render: branch => <Tag>{branch}</Tag>
                  },
                  {
                    title: 'Actions',
                    key: 'actions',
                    render: (_, record) => (
                      <Space>
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => openForm(record)}
                        />
                        <Popconfirm
                          title='Delete teller?'
                          onConfirm={() => handleDelete(record.id)}
                          okText='Yes'
                          cancelText='No'
                        >
                          <Button icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                      </Space>
                    )
                  }
                ]}
                dataSource={filteredTellers}
                rowKey='id'
                loading={loading}
                pagination={{ pageSize: 6 }}
                scroll={{ x: true }}
              />
            )}
          </Tabs.TabPane>
          <Tabs.TabPane tab='Performance' key='performance'>
            <div className='mb-4'>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                allowClear={false}
                format='YYYY-MM-DD'
                style={{ marginBottom: 16 }}
              />
            </div>
            {tellers.length === 0 ? (
              <Empty description='No tellers found' />
            ) : (
              <Table
                columns={[
                  { title: 'Teller', dataIndex: 'name', key: 'name' },
                  {
                    title: 'Branch',
                    dataIndex: 'branch',
                    key: 'branch',
                    render: branch => <Tag>{branch}</Tag>
                  },
                  {
                    title: 'Cash In',
                    key: 'cash',
                    render: (_, teller: Teller) => {
                      // All this teller's cash-ins today
                      const cash = cashIns
                        .filter(
                          cash =>
                            cash.tellerId === teller.uid ||
                            cash.tellerId === teller.id
                        )
                        .reduce((sum, ins) => sum + (ins.cash || 0), 0)
                      return `R${cash.toFixed(2)}`
                    }
                  },
                  {
                    title: 'Bank',
                    key: 'bank',
                    render: (_, teller: Teller) => {
                      const bank = cashIns
                        .filter(
                          cash =>
                            cash.tellerId === teller.uid ||
                            cash.tellerId === teller.id
                        )
                        .reduce((sum, ins) => sum + (ins.bank || 0), 0)
                      return `R${bank.toFixed(2)}`
                    }
                  },
                  {
                    title: 'Credit',
                    key: 'credit',
                    render: (_, teller: Teller) => {
                      const credit = cashIns
                        .filter(
                          cash =>
                            cash.tellerId === teller.uid ||
                            cash.tellerId === teller.id
                        )
                        .reduce((sum, ins) => sum + (ins.credit || 0), 0)
                      return `R${credit.toFixed(2)}`
                    }
                  },
                  {
                    title: 'Expected',
                    key: 'expected',
                    render: (_, teller: Teller) => {
                      const expected = cashInExpectations[teller.branch] || 0
                      return `R${expected.toFixed(2)}`
                    }
                  },
                  {
                    title: 'Status',
                    key: 'status',
                    render: (_, teller: Teller) => {
                      const branchExpected =
                        cashInExpectations[teller.branch] || 0
                      const tellerCashIns = cashIns
                        .filter(
                          cash =>
                            cash.tellerId === teller.uid ||
                            cash.tellerId === teller.id
                        )
                        .reduce((sum, ins) => sum + (ins.cash || 0), 0)
                      const isTargetMet = tellerCashIns >= branchExpected
                      return (
                        <Tag color={isTargetMet ? 'green' : 'red'}>
                          {isTargetMet ? '✔ Over Target' : '✖ Below Target'}
                        </Tag>
                      )
                    }
                  }
                ]}
                dataSource={tellers}
                rowKey='id'
                pagination={false}
                scroll={{ x: true }}
              />
            )}
          </Tabs.TabPane>
        </Tabs>

        <Drawer
          title={editingTeller ? 'Edit Teller' : 'Add Teller'}
          open={isMobile && drawerVisible}
          onClose={() => setDrawerVisible(false)}
          placement='bottom'
          height='auto'
        >
          {renderForm()}
        </Drawer>

        <Modal
          title={editingTeller ? 'Edit Teller' : 'Add Teller'}
          open={!isMobile && modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={null}
        >
          {renderForm()}
        </Modal>
      </div>
    </>
  )
}

export default TellersPage
