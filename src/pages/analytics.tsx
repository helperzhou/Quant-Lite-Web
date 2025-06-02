import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  DatePicker,
  Statistic,
  Spin,
  Typography,
  Modal,
  Button,
  Select
} from 'antd'
import {
  BarChartOutlined,
  DollarOutlined,
  WalletOutlined
} from '@ant-design/icons'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import dayjs, { Dayjs } from 'dayjs'
import { useOutletContext } from 'react-router-dom'
import { useMediaQuery } from 'react-responsive'

const { RangePicker } = DatePicker
const { Title } = Typography
const { Option } = Select

const defaultRange: [Dayjs, Dayjs] = [
  dayjs().startOf('month'),
  dayjs().endOf('month')
]

export default function AnalyticsPage () {
  const { currentUser } = useOutletContext() as { currentUser: any }
  const isDesktop = useMediaQuery({ minWidth: 768 })

  // Filters
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(defaultRange)
  const [branch, setBranch] = useState<string | undefined>(undefined)
  const [branches, setBranches] = useState<string[]>([])

  // Metrics
  const [metrics, setMetrics] = useState({
    revenue: 0,
    profit: 0,
    expenses: 0
  })
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<any>({})
  const [expandedChart, setExpandedChart] = useState<null | string>(null)

  // Fetch available branches for dropdown
  useEffect(() => {
    async function fetchBranches () {
      if (!currentUser?.companyName) return
      const salesQ = query(
        collection(db, 'sales'),
        where('companyName', '==', currentUser.companyName)
      )
      const salesSnap = await getDocs(salesQ)
      const branchSet = new Set<string>()
      salesSnap.forEach(doc => {
        const d = doc.data()
        if (d.branch) branchSet.add(d.branch)
      })
      setBranches(Array.from(branchSet))
    }
    fetchBranches()
  }, [currentUser])

  useEffect(() => {
    if (!currentUser?.companyName) return

    const fetchData = async () => {
      setLoading(true)

      // --- SALES ---
      const salesFilters = [
        where('companyName', '==', currentUser.companyName),
        where('createdAt', '>=', Timestamp.fromDate(dateRange[0].toDate())),
        where('createdAt', '<=', Timestamp.fromDate(dateRange[1].toDate()))
      ]
      if (branch) salesFilters.push(where('branch', '==', branch))
      const salesQ = query(collection(db, 'sales'), ...salesFilters)
      const salesSnap = await getDocs(salesQ)

      let totalRevenue = 0
      let salesTrend: Record<string, number> = {}

      salesSnap.forEach(doc => {
        const d = doc.data()
        const dateLabel = dayjs(d.createdAt?.toDate()).format('YYYY-MM-DD')
        const saleTotal = d.total ?? 0
        totalRevenue += saleTotal
        salesTrend[dateLabel] = (salesTrend[dateLabel] || 0) + saleTotal
      })

      // --- EXPENSES (including drawings, type: 'Drawing') ---
      const expFilters = [
        where('companyName', '==', currentUser.companyName),
        where('createdAt', '>=', Timestamp.fromDate(dateRange[0].toDate())),
        where('createdAt', '<=', Timestamp.fromDate(dateRange[1].toDate()))
      ]
      if (branch) expFilters.push(where('branch', '==', branch))
      const expQ = query(collection(db, 'expenses'), ...expFilters)
      const expSnap = await getDocs(expQ)
      let totalExpenses = 0
      let expenseTrend: Record<string, number> = {}
      let expenseTypeMap: Record<string, number> = {}
      expSnap.forEach(doc => {
        const d = doc.data()
        const dateLabel = dayjs(d.createdAt?.toDate()).format('YYYY-MM-DD')
        totalExpenses += d.amount ?? 0
        expenseTrend[dateLabel] =
          (expenseTrend[dateLabel] || 0) + (d.amount ?? 0)
        const t = d.type || 'Other'
        expenseTypeMap[t] = (expenseTypeMap[t] || 0) + (d.amount ?? 0)
      })

      // PROFIT = Revenue - Expenses
      const netProfit = totalRevenue - totalExpenses

      setMetrics({
        revenue: totalRevenue,
        profit: netProfit,
        expenses: totalExpenses
      })

      setChartData({
        revenue: [
          {
            name: 'Revenue',
            data: Object.entries(salesTrend)
              .sort()
              .map(([k, v]) => [k, v])
          }
        ],
        expenses: [
          {
            name: 'Expenses',
            data: Object.entries(expenseTrend)
              .sort()
              .map(([k, v]) => [k, v])
          }
        ],
        profit: [
          {
            name: 'Net Profit',
            data: Object.keys(salesTrend)
              .sort()
              .map(date => {
                const r = salesTrend[date] || 0
                const e = expenseTrend[date] || 0
                return [date, r - e]
              })
          }
        ],
        expensesByType: [
          {
            name: 'Expense Types',
            colorByPoint: true,
            data: Object.entries(expenseTypeMap).map(([type, val]) => ({
              name: type,
              y: val
            }))
          }
        ]
      })

      setLoading(false)
    }

    fetchData()
  }, [dateRange, branch, currentUser])

  // Chart configs
  const chartConfig = {
    revenue: {
      chart: { type: 'column', height: isDesktop ? 300 : 220 },
      title: { text: 'Revenue Trend' },
      xAxis: { type: 'category' },
      yAxis: { title: { text: 'Revenue' } },
      series: chartData.revenue || []
    },
    profit: {
      chart: { type: 'line', height: isDesktop ? 300 : 220 },
      title: { text: 'Net Profit Trend' },
      xAxis: { type: 'category' },
      yAxis: { title: { text: 'Profit' } },
      series: chartData.profit || []
    },
    expenses: {
      chart: { type: 'area', height: isDesktop ? 300 : 220 },
      title: { text: 'Expenses Trend' },
      xAxis: { type: 'category' },
      yAxis: { title: { text: 'Expenses' } },
      series: chartData.expenses || []
    },
    expensesByType: {
      chart: { type: 'pie', height: isDesktop ? 300 : 220 },
      title: { text: 'Expenses By Type' },
      series: chartData.expensesByType || []
    }
  }

  const cardStyles = [
    {
      color: '#000',
      icon: <DollarOutlined style={{ fontSize: 32, color: 'green' }} />,
      title: 'Revenue',
      value: metrics.revenue,
      prefix: 'R'
    },
    {
      color: '#000',
      icon: (
        <BarChartOutlined
          style={{
            fontSize: 32,
            color: 'limegreen'
          }}
        />
      ),
      title: 'Profit',
      value: metrics.profit,
      prefix: 'R'
    },
    {
      color: '#000',
      icon: <WalletOutlined style={{ fontSize: 32, color: 'crimson' }} />,
      title: 'Expenses',
      value: metrics.expenses,
      prefix: 'R'
    }
  ]

  const renderExpandButton = (key: string) =>
    isDesktop ? (
      <Button
        icon={<BarChartOutlined />}
        type='text'
        onClick={() => setExpandedChart(key)}
      />
    ) : null

  const renderModalChart = (key: keyof typeof chartConfig) => (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        ...chartConfig[key],
        chart: { ...chartConfig[key].chart, height: 500, width: 900 }
      }}
    />
  )

  return (
    <div style={{ padding: isDesktop ? 24 : 8 }}>
      <Title level={3}>Business Analytics</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
        {cardStyles.map((card, i) => (
          <Col xs={24} md={8} key={card.title}>
            <Card
              bordered={false}
              style={{
                background: card.bg,
                color: card.color,
                borderRadius: 12,
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
              }}
              bodyStyle={{
                display: 'flex',
                alignItems: 'center',
                padding: '18px 20px'
              }}
            >
              <div style={{ marginRight: 16 }}>{card.icon}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {card.prefix}
                  {card.value.toLocaleString()}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters row: date + branch */}
      <Row gutter={12} style={{ marginBottom: 18 }}>
        <Col xs={24} md={10}>
          <RangePicker
            value={dateRange}
            onChange={v => setDateRange(v as [Dayjs, Dayjs])}
            style={{ width: '100%' }}
            allowClear={false}
            size={isDesktop ? 'middle' : 'small'}
          />
        </Col>
        <Col xs={24} md={6}>
          <Select
            allowClear
            placeholder='Select Branch'
            value={branch}
            onChange={v => setBranch(v || undefined)}
            style={{ width: '100%' }}
            size={isDesktop ? 'middle' : 'small'}
          >
            {branches.map(b => (
              <Option key={b} value={b}>
                {b}
              </Option>
            ))}
          </Select>
        </Col>
      </Row>

      {/* Charts */}
      {loading ? (
        <Spin />
      ) : (
        <Row gutter={[16, 16]}>
          {(['revenue', 'profit', 'expenses'] as const).map(key => (
            <Col xs={24} md={12} key={key}>
              <Card
                title={chartConfig[key].title.text}
                size='small'
                extra={renderExpandButton(key)}
                style={{ height: '100%' }}
                bodyStyle={{ minHeight: isDesktop ? 320 : 180, padding: 8 }}
              >
                <HighchartsReact
                  highcharts={Highcharts}
                  options={chartConfig[key]}
                />
              </Card>
              <Modal
                open={expandedChart === key}
                title={chartConfig[key].title.text}
                onCancel={() => setExpandedChart(null)}
                footer={null}
                width={950}
                centered
                bodyStyle={{ padding: 0 }}
              >
                {renderModalChart(key)}
              </Modal>
            </Col>
          ))}

          {/* Expense type breakdown as pie */}
          {!!(
            chartData.expensesByType &&
            chartData.expensesByType[0]?.data?.length
          ) && (
            <Col xs={24} md={12}>
              <Card
                title='Expenses By Type'
                size='small'
                extra={renderExpandButton('expensesByType')}
                style={{ height: '100%' }}
                bodyStyle={{ minHeight: isDesktop ? 320 : 180, padding: 8 }}
              >
                <HighchartsReact
                  highcharts={Highcharts}
                  options={chartConfig.expensesByType}
                />
              </Card>
              <Modal
                open={expandedChart === 'expensesByType'}
                title='Expenses By Type'
                onCancel={() => setExpandedChart(null)}
                footer={null}
                width={950}
                centered
                bodyStyle={{ padding: 0 }}
              >
                {renderModalChart('expensesByType')}
              </Modal>
            </Col>
          )}
        </Row>
      )}
    </div>
  )
}
