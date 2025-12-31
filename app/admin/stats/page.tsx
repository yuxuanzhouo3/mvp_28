"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getAdminStats,
  getDailyStats,
  type AdminStatsResult,
  type DailyStatsResult,
} from "@/actions/admin-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  Users,
  DollarSign,
  TrendingUp,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Activity,
  CreditCard,
  UserPlus,
  Calendar,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

// 颜色配置
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const SOURCE_COLORS = { global: "#3b82f6", cn: "#10b981" };

export default function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"all" | "global" | "cn">("all");
  const [stats, setStats] = useState<AdminStatsResult["data"] | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStatsResult["data"] | null>(null);
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(30);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, dailyResult] = await Promise.all([
        getAdminStats(source),
        getDailyStats(timeRange, source),
      ]);

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      } else {
        setError(statsResult.error || "获取统计数据失败");
      }

      if (dailyResult.success && dailyResult.data) {
        setDailyStats(dailyResult.data);
      }
    } catch (err) {
      setError("加载统计数据失败");
    } finally {
      setLoading(false);
    }
  }, [source, timeRange]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // 格式化货币
  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  // 准备图表数据
  const prepareChartData = () => {
    if (!dailyStats) return [];

    // 按日期聚合
    const dateMap = new Map<string, { date: string; global: number; cn: number; total: number }>();

    dailyStats.forEach((item) => {
      if (!dateMap.has(item.date)) {
        dateMap.set(item.date, { date: item.date, global: 0, cn: 0, total: 0 });
      }
      const entry = dateMap.get(item.date)!;
      if (item.source === "global") {
        entry.global = item.activeUsers;
      } else {
        entry.cn = item.activeUsers;
      }
      entry.total = entry.global + entry.cn;
    });

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  // 准备收入图表数据
  const prepareRevenueData = () => {
    if (!dailyStats) return [];

    const dateMap = new Map<string, { date: string; global: number; cn: number; total: number }>();

    dailyStats.forEach((item) => {
      if (!dateMap.has(item.date)) {
        dateMap.set(item.date, { date: item.date, global: 0, cn: 0, total: 0 });
      }
      const entry = dateMap.get(item.date)!;
      if (item.source === "global") {
        entry.global = item.revenue;
      } else {
        entry.cn = item.revenue;
      }
      entry.total = entry.global + entry.cn;
    });

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  // 准备设备分布数据
  const prepareDeviceData = () => {
    if (!stats?.devices.byType) return [];
    return Object.entries(stats.devices.byType).map(([name, value]) => ({
      name: name === "desktop" ? "桌面" : name === "mobile" ? "手机" : name === "tablet" ? "平板" : name,
      value,
    }));
  };

  // 准备操作系统分布数据
  const prepareOSData = () => {
    if (!stats?.devices.byOS) return [];
    return Object.entries(stats.devices.byOS).map(([name, value]) => ({ name, value }));
  };

  // 准备订阅计划分布数据
  const preparePlanData = () => {
    if (!stats?.subscriptions.byPlan) return [];
    return Object.entries(stats.subscriptions.byPlan).map(([name, value]) => ({ name, value }));
  };

  const chartData = prepareChartData();
  const revenueData = prepareRevenueData();
  const deviceData = prepareDeviceData();
  const osData = prepareOSData();
  const planData = preparePlanData();

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* 页头 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">用户数据统计</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看用户、付费、设备等统计数据
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* 数据来源选择 */}
          <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
            <SelectTrigger className="w-[140px]">
              <Globe className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部数据</SelectItem>
              <SelectItem value="global">国际版</SelectItem>
              <SelectItem value="cn">国内版</SelectItem>
            </SelectContent>
          </Select>

          {/* 刷新按钮 */}
          <Button variant="outline" size="icon" onClick={loadStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 加载状态 */}
      {loading && !stats ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 总用户数 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  总用户数
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.users.total)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-green-600">+{stats.users.newToday}</span> 今日新增
                </p>
              </CardContent>
            </Card>

            {/* 活跃用户 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  月活用户
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.activeUsers.mau)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  DAU: {stats.activeUsers.dau} / WAU: {stats.activeUsers.wau}
                </p>
              </CardContent>
            </Card>

            {/* 总收入 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  总收入
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats.payments.totalAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-green-600">
                    +{formatCurrency(stats.payments.todayAmount)}
                  </span>{" "}
                  今日
                </p>
              </CardContent>
            </Card>

            {/* 付费用户 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  付费用户
                </CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.payments.payingUsers)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  转化率:{" "}
                  {stats.users.total > 0
                    ? ((stats.payments.payingUsers / stats.users.total) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 国内外对比卡片 (仅在"全部数据"时显示) */}
          {source === "all" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      国际版
                    </Badge>
                    数据概览
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold">{formatNumber(stats.sourceComparison.global.users)}</p>
                      <p className="text-xs text-muted-foreground">用户数</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(stats.sourceComparison.global.revenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">总收入</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      国内版
                    </Badge>
                    数据概览
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold">{formatNumber(stats.sourceComparison.cn.users)}</p>
                      <p className="text-xs text-muted-foreground">用户数</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(stats.sourceComparison.cn.revenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">总收入</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 图表区域 */}
          <Tabs defaultValue="users" className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="users">用户趋势</TabsTrigger>
                <TabsTrigger value="revenue">收入趋势</TabsTrigger>
                <TabsTrigger value="devices">设备分布</TabsTrigger>
                <TabsTrigger value="plans">订阅分布</TabsTrigger>
              </TabsList>

              {/* 时间范围选择 */}
              <Select
                value={timeRange.toString()}
                onValueChange={(v) => setTimeRange(Number(v) as typeof timeRange)}
              >
                <SelectTrigger className="w-[120px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">最近 7 天</SelectItem>
                  <SelectItem value="14">最近 14 天</SelectItem>
                  <SelectItem value="30">最近 30 天</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 用户趋势图 */}
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>活跃用户趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) => value.slice(5)}
                            className="text-xs"
                          />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          {source === "all" ? (
                            <>
                              <Area
                                type="monotone"
                                dataKey="global"
                                name="国际版"
                                stackId="1"
                                stroke={SOURCE_COLORS.global}
                                fill={SOURCE_COLORS.global}
                                fillOpacity={0.6}
                              />
                              <Area
                                type="monotone"
                                dataKey="cn"
                                name="国内版"
                                stackId="1"
                                stroke={SOURCE_COLORS.cn}
                                fill={SOURCE_COLORS.cn}
                                fillOpacity={0.6}
                              />
                            </>
                          ) : (
                            <Area
                              type="monotone"
                              dataKey="total"
                              name="活跃用户"
                              stroke="#3b82f6"
                              fill="#3b82f6"
                              fillOpacity={0.6}
                            />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        暂无数据
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 收入趋势图 */}
            <TabsContent value="revenue">
              <Card>
                <CardHeader>
                  <CardTitle>收入趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    {revenueData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) => value.slice(5)}
                            className="text-xs"
                          />
                          <YAxis className="text-xs" tickFormatter={(value) => `$${value}`} />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          {source === "all" ? (
                            <>
                              <Bar dataKey="global" name="国际版" fill={SOURCE_COLORS.global} />
                              <Bar dataKey="cn" name="国内版" fill={SOURCE_COLORS.cn} />
                            </>
                          ) : (
                            <Bar dataKey="total" name="收入" fill="#3b82f6" />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        暂无数据
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 设备分布 */}
            <TabsContent value="devices">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>设备类型分布</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {deviceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={deviceData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) =>
                                `${name} ${(percent * 100).toFixed(0)}%`
                              }
                            >
                              {deviceData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          暂无设备数据
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>操作系统分布</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {osData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={osData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) =>
                                `${name} ${(percent * 100).toFixed(0)}%`
                              }
                            >
                              {osData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          暂无系统数据
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 订阅分布 */}
            <TabsContent value="plans">
              <Card>
                <CardHeader>
                  <CardTitle>订阅计划分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 饼图 */}
                    <div className="h-[300px]">
                      {planData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={planData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) =>
                                `${name} ${(percent * 100).toFixed(0)}%`
                              }
                            >
                              {planData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          暂无订阅数据
                        </div>
                      )}
                    </div>

                    {/* 统计数字 */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">总订阅数</span>
                        <span className="text-2xl font-bold">{stats.subscriptions.total}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">
                          活跃订阅
                        </span>
                        <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                          {stats.subscriptions.active}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {planData.map((plan, index) => (
                          <div
                            key={plan.name}
                            className="flex justify-between items-center p-2 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-sm">{plan.name}</span>
                            </div>
                            <span className="font-medium">{plan.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* 更新时间 */}
          <p className="text-xs text-muted-foreground text-center">
            数据更新时间: {new Date(stats.generatedAt).toLocaleString("zh-CN")}
          </p>
        </>
      ) : null}
    </div>
  );
}
