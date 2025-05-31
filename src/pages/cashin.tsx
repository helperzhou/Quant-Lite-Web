import React, { useEffect, useState } from 'react'
import {
  Card,
  Button,
  Tag,
  Modal,
  Input,
  Typography,
  Row,
  Col,
  message,
  Space,
  Grid,
  Empty,
  Table
} from 'antd'
import { ShopOutlined, DollarOutlined } from '@ant-design/icons'
import { db } from '../firebase'
import {
  collection,
  getDoc,
  getDocs,
  addDoc,
  doc,
  query,
  where,
  Timestamp
} from 'firebase/firestore'
import { useOutletContext } from 'react-router-dom'
import type { Teller, BranchExpected } from '../types/type'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

// Utility: Get start/end of today as Firestore Timestamp
function getTodayRange () {
  const now = new Date()
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  )
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  )
  return {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end)
  }
}

export default function CashInScreen () {
  const [messageApi, contextHolder] = message.useMessage()
  const { currentUser } = useOutletContext()
  const screens = useBreakpoint()
  const [adminBranches, setAdminBranches] = useState<string[]>([])
  const [companyName, setCompanyName] = useState('')
  const [tellers, setTellers] = useState<Teller[]>([])
  const [branchExpectedCash, setBranchExpectedCash] = useState<BranchExpected>(
    {}
  )
  const [cashInModalVisible, setCashInModalVisible] = useState(false)
  const [selectedTeller, setSelectedTeller] = useState<Teller | null>(null)
  const [cashInForm, setCashInForm] = useState<{
    cash: string
    bank: string
    credit: string
  }>({
    cash: '',
    bank: '',
    credit: ''
  })
  const [branchSearch, setBranchSearch] = useState('')
  const [tellerSearch, setTellerSearch] = useState('')

  // Fetch user info, branches, tellers on mount
  useEffect(() => {
    async function fetchData () {
      if (!currentUser?.uid) return

      // 1. User info
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
      const userData = userDoc.data()
      const branches = userData?.branches || []
      setAdminBranches(branches)
      setCompanyName(userData?.companyName || '')

      // 2. Tellers for this company
      const tellersSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('companyName', '==', userData?.companyName),
          where('userRole', '==', 'teller') // only get tellers
        )
      )
      const tellersFiltered = tellersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setTellers(tellersFiltered)
    }
    fetchData()
  }, [currentUser])

  // Fetch today’s expected cash-in per branch (from sales)
  useEffect(() => {
    async function fetchBranchExpected () {
      if (!adminBranches.length) return
      const { start, end } = getTodayRange()
      const result = {}

      // For each branch, sum cash sales for today
      for (const branch of adminBranches) {
        const salesQ = query(
          collection(db, 'sales'),
          where('branch', '==', branch),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end)
        )
        const snap = await getDocs(salesQ)
        let cash = 0
        snap.forEach(doc => {
          const sale = doc.data()
          if (sale.paymentType === 'Cash') cash += sale.total
        })
        result[branch] = cash
      }
      setBranchExpectedCash(result)
    }
    fetchBranchExpected()
  }, [adminBranches])

  // Branch summary array
  const branchData = adminBranches.map(branch => ({
    branch,
    expected: branchExpectedCash[branch] || 0
  }))

  const filteredBranchData = branchData.filter(
    b =>
      !branchSearch ||
      b.branch.toLowerCase().includes(branchSearch.toLowerCase())
  )

  // Teller list, optionally filtered
  const tellerData = tellers.filter(
    t =>
      (!tellerSearch ||
        t.name.toLowerCase().includes(tellerSearch.toLowerCase()) ||
        t.branch.toLowerCase().includes(tellerSearch.toLowerCase())) &&
      adminBranches.includes(t.branch)
  )

  // Open cash-in modal for teller
  const openTellerModal = (teller: Teller) => {
    setSelectedTeller(teller)
    setCashInForm({ cash: '', bank: '', credit: '' })
    setCashInModalVisible(true)
  }

  // Save cash-in to cashIns collection
  const handleSubmit = async () => {
    try {
      const cash = parseFloat(cashInForm.cash) || 0
      const bank = parseFloat(cashInForm.bank) || 0
      const credit = parseFloat(cashInForm.credit) || 0
      if (cash <= 0 && bank <= 0 && credit <= 0) {
        messageApi.error('Please enter at least one positive amount')
        return
      }
      await addDoc(collection(db, 'cashIns'), {
        branch: selectedTeller.branch,
        tellerId: selectedTeller.id,
        tellerName: selectedTeller.name,
        cash,
        bank,
        credit,
        type: 'cash',
        date: Timestamp.now(),
        companyName,
        adminId: currentUser.uid
      })
      messageApi.success(`Cash in recorded for ${selectedTeller.name}`)
      setCashInModalVisible(false)
      setSelectedTeller(null)
      setCashInForm({ cash: '', bank: '', credit: '' })
    } catch (error) {
      messageApi.error('Error saving cash in')
    }
  }

  return (
    <>
      {contextHolder}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 12 }}>
        <Title level={4} style={{ textAlign: 'center', marginBottom: 18 }}>
          Cash In Dashboard
        </Title>

        {/* Branch summary */}
        <Title level={5} style={{ marginBottom: 8 }}>
          Branch Summary
        </Title>
        <Row gutter={[16, 16]}>
          {filteredBranchData.length === 0 ? (
            <Col span={24}>
              <Empty description='No branches found' />
            </Col>
          ) : (
            filteredBranchData.map(branch => (
              <Col xs={24} sm={12} md={8} key={branch.branch}>
                <Card
                  size='small'
                  style={{ borderRadius: 10, minHeight: 120 }}
                  bodyStyle={{ padding: 18 }}
                >
                  <Space align='center' style={{ marginBottom: 10 }}>
                    <ShopOutlined style={{ fontSize: 28, color: '#1677ff' }} />
                    <Title level={5} style={{ margin: 0 }}>
                      {branch.branch}
                    </Title>
                  </Space>
                  <Row gutter={[8, 0]}>
                    <Col span={24}>
                      <Text>
                        Expected Cash In Today: <b>R{branch.expected}</b>
                      </Text>
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))
          )}
        </Row>

        {/* Teller cash-in (table or cards) */}
        <Title level={5} style={{ marginTop: 32, marginBottom: 8 }}>
          Teller Cash-In
        </Title>
        <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
          <Col span={24}>
            <Input.Search
              placeholder='Search teller or branch...'
              allowClear
              value={tellerSearch}
              onChange={e => setTellerSearch(e.target.value)}
            />
          </Col>
        </Row>
        {screens.md ? (
          <Table
            dataSource={tellerData}
            rowKey='id'
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: 'Teller',
                dataIndex: 'name',
                key: 'name',
                render: (name, record) => (
                  <span>
                    {name} <Tag>{record.branch}</Tag>
                  </span>
                )
              },
              {
                title: 'Action',
                key: 'action',
                align: 'center',
                render: (_, rec) => (
                  <Button type='primary' onClick={() => openTellerModal(rec)}>
                    Record Cash-In
                  </Button>
                )
              }
            ]}
          />
        ) : (
          <Row gutter={[10, 12]}>
            {tellerData.length === 0 ? (
              <Col span={24}>
                <Empty description='No tellers found' />
              </Col>
            ) : (
              tellerData.map(item => (
                <Col xs={24} key={item.id}>
                  <Card
                    style={{
                      borderRadius: 10,
                      background: '#fff',
                      marginBottom: 12
                    }}
                    bodyStyle={{ padding: 14 }}
                    onClick={() => openTellerModal(item)}
                    hoverable
                  >
                    <Row align='middle' justify='space-between'>
                      <Col>
                        <Text strong>{item.name}</Text>
                        <div style={{ color: '#888' }}>
                          Branch: {item.branch}
                        </div>
                      </Col>
                    </Row>
                    <Button
                      type='primary'
                      block
                      style={{ marginTop: 8 }}
                      onClick={e => {
                        e.stopPropagation()
                        openTellerModal(item)
                      }}
                    >
                      Record Cash-In
                    </Button>
                  </Card>
                </Col>
              ))
            )}
          </Row>
        )}

        {/* --- Cash-In Modal for Teller --- */}
        <Modal
          open={cashInModalVisible}
          title={selectedTeller ? `Cash In - ${selectedTeller.name}` : ''}
          onCancel={() => setCashInModalVisible(false)}
          footer={null}
          centered
          destroyOnClose
          width={350}
        >
          {selectedTeller && (
            <div>
              <Text strong>Branch: {selectedTeller.branch}</Text>
              <br />
              <Text>
                Expected for branch:{' '}
                <b>R{branchExpectedCash[selectedTeller.branch] || 0}</b>
              </Text>
              <Input
                type='number'
                min={0}
                placeholder='Cash Amount'
                value={cashInForm.cash}
                onChange={e =>
                  setCashInForm({ ...cashInForm, cash: e.target.value })
                }
                style={{ margin: '10px 0 6px 0' }}
              />
              <Input
                type='number'
                min={0}
                placeholder='Bank Amount'
                value={cashInForm.bank}
                onChange={e =>
                  setCashInForm({ ...cashInForm, bank: e.target.value })
                }
                style={{ margin: '6px 0' }}
              />
              <Input
                type='number'
                min={0}
                placeholder='Credit Amount'
                value={cashInForm.credit}
                onChange={e =>
                  setCashInForm({ ...cashInForm, credit: e.target.value })
                }
                style={{ margin: '6px 0 18px 0' }}
              />
              <Row gutter={8}>
                <Col span={12}>
                  <Button block onClick={() => setCashInModalVisible(false)}>
                    Cancel
                  </Button>
                </Col>
                <Col span={12}>
                  <Button
                    type='primary'
                    block
                    onClick={handleSubmit}
                    disabled={
                      !cashInForm.cash && !cashInForm.bank && !cashInForm.credit
                    }
                  >
                    Submit
                  </Button>
                </Col>
              </Row>
            </div>
          )}
        </Modal>
      </div>
    </>
  )
}
