import { useEffect, useState } from 'react'
import {
  Typography,
  Row,
  Col,
  Divider,
  Select,
  List,
  Card,
  Spin,
  Badge,
  Grid
} from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {
  ShoppingCartOutlined,
  AppstoreOutlined,
  ExclamationCircleOutlined,
  AlertOutlined,
  LineChartOutlined
} from '@ant-design/icons'
import { db } from '../firebase'
import { collection, getDocs } from 'firebase/firestore'
import type { Product } from '../types/type'
import dayjs from 'dayjs'

const { Text } = Typography
const { useBreakpoint } = Grid

const now = dayjs()
const months = Array.from({ length: now.month() + 1 }, (_, i) =>
  dayjs().month(i).format('MMM')
)
const monthKeys = Array.from({ length: now.month() + 1 }, (_, i) =>
  dayjs().month(i).format('YYYY-MM')
)

type Props = {
  products: Product[]
}

const productIcon = (item?: Product) => {
  if (!item) return <AppstoreOutlined style={{ color: '#bcbcbc' }} />
  const name = (item.name || '').toLowerCase()
  if (item.type === 'service') {
    return <AppstoreOutlined style={{ color: '#1976d2' }} />
  }
  if (name.includes('meal') || name.includes('food') || name.includes('rice'))
    return <AppstoreOutlined style={{ color: '#ff9800' }} />
  return <ShoppingCartOutlined style={{ color: '#1890ff' }} />
}

const asDisplayValue = (item: Product) =>
  item.type === 'service'
    ? Number(item.availableValue ?? 0)
    : Number(item.qty ?? 0)
const asDisplayPrice = (item: Product) =>
  Number(item.unitPrice ?? item.price ?? 0)

const ProductStatisticsDashboard = ({ products }: Props) => {
  const [loading, setLoading] = useState(true)
  const [monthlySales, setMonthlySales] = useState<{
    [productId: string]: number[]
  }>({})
  const [trendProduct, setTrendProduct] = useState(products[0]?.name || '')
  const screens = useBreakpoint()
  const isMobile = !screens.md

  // --- Fetch sales and aggregate monthly sales for each product ---
  useEffect(() => {
    const fetchMonthlySales = async () => {
      setLoading(true)
      const salesSnapshot = await getDocs(collection(db, 'sales'))
      const sales = salesSnapshot.docs.map(doc => doc.data())
      const salesPerProduct: { [productId: string]: number[] } = {}
      for (const sale of sales) {
        const date = sale.createdAt?.toDate
          ? sale.createdAt.toDate()
          : sale.createdAt
          ? new Date(sale.createdAt)
          : null
        if (!date) continue
        const monthKey = dayjs(date).format('YYYY-MM')
        const monthIdx = monthKeys.indexOf(monthKey)
        if (monthIdx === -1) continue
        const cart: any[] = Array.isArray(sale.cart)
          ? sale.cart
          : sale.items || []
        for (const item of cart) {
          if (!item.id) continue
          if (!salesPerProduct[item.id]) {
            salesPerProduct[item.id] = Array(months.length).fill(0)
          }
          salesPerProduct[item.id][monthIdx] += Number(
            item.quantity || item.qty || 0
          )
        }
      }
      setMonthlySales(salesPerProduct)
      setLoading(false)
    }
    fetchMonthlySales()
    // eslint-disable-next-line
  }, [products.length])

  // Low stock alert: only products (not services) where qty <= minQty
  const alerts = products.filter(
    p => p.type !== 'service' && asDisplayValue(p) <= (Number(p.minQty) || 0)
  )
  const productCount = products.filter(p => p.type !== 'service').length
  const lowStockCount = alerts.length

  // Metrics
  const totalValue = products.reduce(
    (sum, p) => sum + asDisplayValue(p) * asDisplayPrice(p),
    0
  )

  // --- Trends ---
  const selectedProduct = products.find(p => p.name === trendProduct)
  const selectedId = selectedProduct?.id
  const lineData =
    selectedId && monthlySales[selectedId]
      ? monthlySales[selectedId]
      : Array(months.length).fill(0)
  const barData = months.map((_, i) =>
    products.reduce((sum, p) => sum + (monthlySales[p.id]?.[i] || 0), 0)
  )
  const topThree = [...products]
    .map(p => ({
      ...p,
      sold: monthlySales[p.id]
        ? monthlySales[p.id].reduce((a, b) => a + b, 0)
        : 0
    }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 3)

  // Highcharts configs (always show labels, small font for mobile)
  const dataLabelStyle = {
    fontWeight: 'bold',
    fontSize: isMobile ? '11px' : '13px'
  }

  const miniBarOptions = {
    chart: {
      type: 'column',
      height: isMobile ? 200 : 240,
      backgroundColor: 'transparent'
    },
    title: {
      text: '',
      style: { fontSize: isMobile ? 14 : 16 }
    },
    xAxis: {
      categories: topThree.map(p => p.name),
      labels: {
        style: { fontSize: isMobile ? 11 : 13 },
        title: { text: 'Product' }
      }
    },
    yAxis: {
      title: { text: 'Units Sold', style: { fontSize: isMobile ? 11 : 13 } },
      visible: true
    },
    legend: { enabled: false },
    credits: { enabled: false },
    tooltip: { pointFormat: '<b>{point.y} units sold</b>' },
    plotOptions: {
      column: {
        dataLabels: {
          enabled: true,
          format: '{y}',
          crop: false,
          overflow: 'allow',
          style: dataLabelStyle
        }
      }
    },
    series: [
      {
        type: 'column',
        name: 'Units Sold',
        data: topThree.map(p => p.sold),
        color: '#1976D2'
      }
    ]
  }

  const trendLineOptions = {
    chart: {
      type: 'areaspline',
      height: isMobile ? 200 : 240,
      backgroundColor: 'transparent'
    },
    title: {
      text: `Monthly Sales Trend: ${trendProduct}`,
      style: { fontSize: isMobile ? 14 : 16 }
    },
    xAxis: {
      categories: months,
      labels: { style: { fontSize: isMobile ? 11 : 13 } },
      title: { text: 'Month', style: { fontSize: isMobile ? 11 : 13 } }
    },
    yAxis: {
      title: { text: 'Units Sold', style: { fontSize: isMobile ? 11 : 13 } },
      gridLineWidth: 0
    },
    legend: { enabled: false },
    credits: { enabled: false },
    tooltip: { valueSuffix: ' units' },
    plotOptions: {
      areaspline: {
        dataLabels: {
          enabled: true,
          format: '{y}',
          crop: false,
          overflow: 'allow',
          style: dataLabelStyle
        }
      }
    },
    series: [
      {
        name: trendProduct,
        data: lineData,
        color: '#6C63FF',
        fillOpacity: 0.15,
        marker: { radius: isMobile ? 3 : 5 }
      }
    ]
  }

  const barChartOptions = {
    chart: {
      type: 'column',
      height: isMobile ? 240 : 260,
      backgroundColor: 'transparent'
    },
    title: {
      text: 'Total Units Sold (All Products)',
      style: { fontSize: isMobile ? 14 : 16 }
    },
    xAxis: {
      categories: months,
      title: { text: 'Month', style: { fontSize: isMobile ? 11 : 13 } }
    },
    yAxis: {
      title: { text: 'Units Sold', style: { fontSize: isMobile ? 11 : 13 } }
    },
    credits: { enabled: false },
    tooltip: { valueSuffix: ' units' },
    plotOptions: {
      column: {
        dataLabels: {
          enabled: true,
          format: '{y}',
          crop: false,
          overflow: 'allow',
          style: dataLabelStyle
        }
      }
    },
    series: [
      {
        name: 'Total Units Sold',
        data: barData,
        color: '#6C63FF'
      }
    ]
  }

  useEffect(() => {
    if (products[0]?.name) setTrendProduct(products[0].name)
  }, [products])

  // Responsive cards: stack on mobile, row on desktop
  return (
    <div>
      {loading ? (
        <Spin />
      ) : (
        <>
          <Row
            gutter={[isMobile ? 0 : 16, 16]}
            justify={isMobile ? 'center' : 'space-between'}
            style={{ marginBottom: 18 }}
          >
            <Col xs={24} sm={24} md={8}>
              <Card
                size='small'
                style={{
                  textAlign: 'center',
                  borderRadius: 12,
                  background: '#F5F7FA',
                  marginBottom: isMobile ? 12 : 0
                }}
                bodyStyle={{
                  padding: isMobile ? 12 : 18
                }}
              >
                <AppstoreOutlined
                  style={{
                    color: '#1976d2',
                    fontSize: isMobile ? 24 : 32,
                    marginBottom: 6
                  }}
                />
                <Text type='secondary' style={{ fontSize: isMobile ? 12 : 13 }}>
                  Total Products
                </Text>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 26 : 32 }}>
                  {productCount}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Card
                size='small'
                style={{
                  textAlign: 'center',
                  borderRadius: 12,
                  background: '#FFF2F0',
                  marginBottom: isMobile ? 12 : 0
                }}
                bodyStyle={{
                  padding: isMobile ? 12 : 18
                }}
              >
                <AlertOutlined
                  style={{
                    color: '#e53935',
                    fontSize: isMobile ? 24 : 32,
                    marginBottom: 6
                  }}
                />
                <Text type='secondary' style={{ fontSize: isMobile ? 12 : 13 }}>
                  Low Stock
                </Text>
                <div
                  style={{
                    fontWeight: 700,
                    color: '#e53935',
                    fontSize: isMobile ? 26 : 32
                  }}
                >
                  {lowStockCount}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Card
                size='small'
                style={{
                  textAlign: 'center',
                  borderRadius: 12,
                  background: '#EFF7FE'
                }}
                bodyStyle={{
                  padding: isMobile ? 12 : 18
                }}
              >
                <LineChartOutlined
                  style={{
                    color: '#1890ff',
                    fontSize: isMobile ? 24 : 32,
                    marginBottom: 6
                  }}
                />
                <Text type='secondary' style={{ fontSize: isMobile ? 12 : 13 }}>
                  Inventory Value
                </Text>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 20 : 22 }}>
                  R{totalValue.toFixed(2)}
                </div>
              </Card>
            </Col>
          </Row>

          <Divider style={{ margin: '16px 0' }}>
            Top Sellers (Units Sold)
          </Divider>
          <HighchartsReact
            highcharts={Highcharts}
            options={miniBarOptions}
            containerProps={{ style: { width: '100%' } }}
          />

          <Divider style={{ margin: '18px 0' }}>Monthly Sales Overview</Divider>
          <HighchartsReact
            highcharts={Highcharts}
            options={barChartOptions}
            containerProps={{ style: { width: '100%' } }}
          />
          <Divider>Product Trend</Divider>
          <Select
            showSearch
            virtual
            style={{
              width: '100%',
              maxWidth: 350,
              margin: '0 auto 18px auto',
              display: 'block'
            }}
            placeholder='Select Product'
            value={trendProduct}
            options={products.map(p => ({
              label: (
                <span>
                  {productIcon(p)} {p.name}
                </span>
              ),
              value: p.name
            }))}
            onChange={setTrendProduct}
            filterOption={(input, option) =>
              (option?.label as any)?.props?.children?.[1]
                ?.toLowerCase()
                .includes(input.toLowerCase())
            }
            optionLabelProp='label'
          />
          <HighchartsReact
            highcharts={Highcharts}
            options={trendLineOptions}
            containerProps={{ style: { width: '100%' } }}
          />

          <Divider>
            Alerts{' '}
            <Badge
              count={alerts.length}
              style={{
                backgroundColor: alerts.length > 0 ? '#f5222d' : '#bcbcbc',
                marginLeft: 10
              }}
              showZero
            />
          </Divider>
          {alerts.length === 0 ? (
            <Text type='secondary'>No critical alerts.</Text>
          ) : (
            <List
              itemLayout='horizontal'
              dataSource={alerts}
              renderItem={(item: Product) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={productIcon(item)}
                    title={
                      <span style={{ color: '#E53935', fontWeight: 700 }}>
                        {item.name}
                      </span>
                    }
                    description={
                      <span>
                        <b>Stock:</b> {asDisplayValue(item)} &nbsp;|&nbsp;
                        <b>Min Required:</b> {item.minQty ?? 0}
                      </span>
                    }
                  />
                </List.Item>
              )}
              style={{
                background: '#FDECEA',
                borderRadius: 8,
                padding: 12,
                marginBottom: 10
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

export default ProductStatisticsDashboard
