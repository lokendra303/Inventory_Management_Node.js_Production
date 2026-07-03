import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ItemsScreen from '../screens/ItemsScreen';
import ItemDetailScreen from '../screens/ItemDetailScreen';
import ItemFormScreen from '../screens/ItemFormScreen';
import ItemGroupsScreen from '../screens/ItemGroupsScreen';
import InventoryScreen from '../screens/InventoryScreen';
import GrnScreen from '../screens/GrnScreen';
import GrnReceiveScreen from '../screens/GrnReceiveScreen';
import StockCountScreen from '../screens/StockCountScreen';
import StockCountDetailScreen from '../screens/StockCountDetailScreen';
import PutawayScreen from '../screens/PutawayScreen';
import BatchTrackingScreen from '../screens/BatchTrackingScreen';
import WarehousesScreen from '../screens/WarehousesScreen';
import WarehouseLocationsScreen from '../screens/WarehouseLocationsScreen';
import AdjustmentsScreen from '../screens/AdjustmentsScreen';
import TransfersScreen from '../screens/TransfersScreen';
import TransferApprovalsScreen from '../screens/TransferApprovalsScreen';
import PurchaseOrdersScreen from '../screens/PurchaseOrdersScreen';
import PurchaseOrderDetailScreen from '../screens/PurchaseOrderDetailScreen';
import SalesOrdersScreen from '../screens/SalesOrdersScreen';
import SalesOrderDetailScreen from '../screens/SalesOrderDetailScreen';
import CustomersScreen from '../screens/CustomersScreen';
import VendorsScreen from '../screens/VendorsScreen';
import DeliveryChallansScreen from '../screens/DeliveryChallansScreen';
import ScanScreen from '../screens/ScanScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SkuRulesScreen from '../screens/SkuRulesScreen';
import GenericApiListScreen from '../screens/GenericApiListScreen';
import FeaturePlaceholderScreen from '../screens/FeaturePlaceholderScreen';
import InvoiceDashboardScreen from '../screens/InvoiceDashboardScreen';
import OutstandingInvoicesScreen from '../screens/OutstandingInvoicesScreen';
import AccountingScreen from '../screens/AccountingScreen';
import ProfitLossScreen from '../screens/ProfitLossScreen';
import ReportsHubScreen from '../screens/ReportsHubScreen';
import CompanySettingsScreen from '../screens/CompanySettingsScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import AuditTrailScreen from '../screens/AuditTrailScreen';
import CustomDrawerContent from './CustomDrawerContent';
import { screensForStack } from '../config/screenRegistry';
import { colors } from '../config/theme';

const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ItemsStack = createNativeStackNavigator();
const InventoryStack = createNativeStackNavigator();
const MoreDrawer = createDrawerNavigator();
const MoreStack = createNativeStackNavigator();

function registerListScreens(Stack, stackName) {
  return screensForStack(stackName).map(({ name, title }) => (
    <Stack.Screen
      key={name}
      name={name}
      component={GenericApiListScreen}
      options={{ title }}
    />
  ));
}

function ItemsNavigator() {
  return (
    <ItemsStack.Navigator>
      <ItemsStack.Screen name="ItemsList" component={ItemsScreen} options={{ headerShown: false }} />
      <ItemsStack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Item' }} />
      <ItemsStack.Screen name="ItemForm" component={ItemFormScreen} options={{ title: 'Item form' }} />
      <ItemsStack.Screen name="ItemGroups" component={ItemGroupsScreen} options={{ title: 'Item groups' }} />
      {registerListScreens(ItemsStack, 'items')}
    </ItemsStack.Navigator>
  );
}

function InventoryNavigator() {
  return (
    <InventoryStack.Navigator>
      <InventoryStack.Screen name="InventoryMain" component={InventoryScreen} options={{ headerShown: false }} />
      <InventoryStack.Screen name="GrnList" component={GrnScreen} options={{ title: 'Receive (GRN)' }} />
      <InventoryStack.Screen name="GrnReceive" component={GrnReceiveScreen} options={{ title: 'Post GRN' }} />
      <InventoryStack.Screen name="StockCounts" component={StockCountScreen} options={{ title: 'Stock count' }} />
      <InventoryStack.Screen name="StockCountDetail" component={StockCountDetailScreen} options={{ title: 'Count lines' }} />
      <InventoryStack.Screen name="Putaways" component={PutawayScreen} options={{ title: 'Putaway' }} />
      <InventoryStack.Screen name="BatchTracking" component={BatchTrackingScreen} options={{ title: 'Batch / serial' }} />
      <InventoryStack.Screen name="Warehouses" component={WarehousesScreen} options={{ title: 'Warehouses' }} />
      <InventoryStack.Screen name="WarehouseLocations" component={WarehouseLocationsScreen} options={{ title: 'Zones / racks / bins' }} />
      <InventoryStack.Screen name="Adjustments" component={AdjustmentsScreen} options={{ title: 'Adjustments' }} />
      <InventoryStack.Screen name="Transfers" component={TransfersScreen} options={{ title: 'Move stock' }} />
      <InventoryStack.Screen name="TransferApprovals" component={TransferApprovalsScreen} options={{ title: 'Transfer approvals' }} />
      <InventoryStack.Screen
        name="Packages"
        component={FeaturePlaceholderScreen}
        initialParams={{
          title: 'Packages',
          message: 'Package tracking is not available yet. Use Shipments and Delivery Challans for outbound fulfillment.',
          icon: 'package-variant-closed',
        }}
        options={{ title: 'Packages' }}
      />
      {registerListScreens(InventoryStack, 'inventory')}
    </InventoryStack.Navigator>
  );
}

function MoreDrawerNav() {
  return (
    <MoreDrawer.Navigator drawerContent={(props) => <CustomDrawerContent {...props} />} screenOptions={{ headerTintColor: colors.primary }}>
      <MoreDrawer.Screen name="SettingsMain" component={SettingsScreen} options={{ title: 'Settings' }} />
      <MoreDrawer.Screen name="SkuRules" component={SkuRulesScreen} options={{ title: 'SKU rules' }} />
    </MoreDrawer.Navigator>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerTintColor: colors.primary }}>
      <MoreStack.Screen name="MoreRoot" component={MoreDrawerNav} options={{ headerShown: false }} />
      <MoreStack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} options={{ title: 'Purchase orders' }} />
      <MoreStack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} options={{ title: 'PO detail' }} />
      <MoreStack.Screen name="SalesOrders" component={SalesOrdersScreen} options={{ title: 'Sales orders' }} />
      <MoreStack.Screen name="SalesOrderDetail" component={SalesOrderDetailScreen} options={{ title: 'SO detail' }} />
      <MoreStack.Screen name="Customers" component={CustomersScreen} options={{ title: 'Customers' }} />
      <MoreStack.Screen name="Vendors" component={VendorsScreen} options={{ title: 'Vendors' }} />
      <MoreStack.Screen name="DeliveryChallans" component={DeliveryChallansScreen} options={{ title: 'Delivery challans' }} />
      <MoreStack.Screen name="InvoiceDashboard" component={InvoiceDashboardScreen} options={{ title: 'Invoice dashboard' }} />
      <MoreStack.Screen name="OutstandingInvoices" component={OutstandingInvoicesScreen} options={{ title: 'Outstanding' }} />
      <MoreStack.Screen name="Accounting" component={AccountingScreen} options={{ title: 'Accounting' }} />
      <MoreStack.Screen name="ProfitLoss" component={ProfitLossScreen} options={{ title: 'Profit & loss' }} />
      <MoreStack.Screen name="ReportsHub" component={ReportsHubScreen} options={{ title: 'Reports' }} />
      <MoreStack.Screen name="CompanySettings" component={CompanySettingsScreen} options={{ title: 'Company settings' }} />
      <MoreStack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Subscription' }} />
      <MoreStack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Documents' }} />
      <MoreStack.Screen name="AuditTrail" component={AuditTrailScreen} options={{ title: 'Audit trail' }} />
      <MoreStack.Screen
        name="KitAssembly"
        component={FeaturePlaceholderScreen}
        initialParams={{
          title: 'Manufacturing',
          message: 'Full kit assembly and BOM editing are available on the web app. View BOM items from the Production menu.',
          icon: 'factory',
        }}
        options={{ title: 'Manufacturing' }}
      />
      <MoreStack.Screen
        name="UserGuide"
        component={FeaturePlaceholderScreen}
        initialParams={{
          title: 'User guide',
          message: 'Open the web app User Guide for full process documentation and workflow diagrams.',
          icon: 'book-open-page-variant-outline',
        }}
        options={{ title: 'User guide' }}
      />
      {registerListScreens(MoreStack, 'more')}
    </MoreStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      lazy
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => {
          const map = {
            HomeTab: 'home-outline',
            ItemsTab: 'cube-outline',
            ScanTab: 'barcode-scan',
            InventoryTab: 'warehouse',
            MoreTab: 'menu',
          };
          return <MaterialCommunityIcons name={map[route.name] || 'circle'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="ItemsTab" component={ItemsNavigator} options={{ title: 'Items' }} />
      <Tab.Screen name="ScanTab" component={ScanScreen} options={{ title: 'Scan' }} />
      <Tab.Screen name="InventoryTab" component={InventoryNavigator} options={{ title: 'Inventory' }} />
      <Tab.Screen name="MoreTab" component={MoreNavigator} options={{ title: 'More', headerShown: false }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
      </AuthStack.Navigator>
    );
  }

  return <MainTabs />;
}
