package com.molinobriganti.operatorlite;

import android.app.AlertDialog;
import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final String API_SCHEME = "http";
    private static final String API_HOST = "192.168.1.248";
    private static final String API_PORT_SHADOW = "5001";
    private static final String API_PORT_PROD = "5000";
    private static final String PREFS_NAME = "operatorlite_prefs";
    private static final String PREF_API_PORT = "api_port";
    private static final long AUTO_REFRESH_INTERVAL_MS = 15000L;
    private static final String STEP_CATEGORY = "category";
    private static final String STEP_SUBCATEGORY = "subcategory";
    private static final String STEP_GROUP = "group";
    private static final String STEP_PRODUCTS = "products";
    private static final String GROUP_NONE_KEY = "__NO_GROUP__";
    private static final String WAREHOUSE_STEP_CATEGORY = "warehouse_category";
    private static final String WAREHOUSE_STEP_SUBCATEGORY = "warehouse_subcategory";
    private static final String WAREHOUSE_STEP_GROUP = "warehouse_group";
    private static final String WAREHOUSE_STEP_PRODUCTS = "warehouse_products";

    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private final Handler uiHandler = new Handler(Looper.getMainLooper());
    private final Runnable autoRefreshRunnable = new Runnable() {
        @Override
        public void run() {
            if (token != null && !token.trim().isEmpty() && currentUserId > 0 && dashboardSection != null && dashboardSection.getVisibility() == View.VISIBLE) {
                if ("tasks".equals(activeModule)) {
                    loadAndShowTasksDialog();
                } else {
                    loadInstantData();
                }
                uiHandler.postDelayed(this, AUTO_REFRESH_INTERVAL_MS);
            }
        }
    };

    private View loginSection;
    private View dashboardSection;
    private GridLayout operatorGrid;
    private TextView txtOperatorPrompt;
    private LinearLayout adminLoginPanel;
    private Spinner adminUserSelect;
    private EditText adminPasswordInput;
    private Button adminLoginBtn;
    private Button btnApiTargetToggle;
    private Button btnLoginRefresh;
    private TextView txtLoginStatus;
    private TextView txtCurrentOperator;
    private Button btnTasks;
    private Button btnInstant;
    private Button btnWarehouse;
    private Button btnLogout;
    private Button btnWarehouseProductsView;
    private Button btnWarehouseShelvesView;
    private Button btnSectorA;
    private Button btnSectorB;
    private Button btnSectorC;
    private Button btnClearLines;
    private Button btnConfirmOrder;
    private TextView txtProductsTitle;
    private TextView txtInstantStepHint;
    private LinearLayout leftMainPanel;
    private LinearLayout rightOrderPanel;
    private LinearLayout warehouseSection;
    private LinearLayout warehouseSectorRow;
    private LinearLayout warehouseProductsPanel;
    private ScrollView warehouseShelvesPanel;
    private LinearLayout warehouseCategoryRow;
    private LinearLayout warehouseSubcategoryRow;
    private LinearLayout warehousePositionsContainer;
    private LinearLayout instantCategoryGrid;
    private LinearLayout instantSubcategoryGrid;
    private ScrollView instantProductsScroll;
    private LinearLayout instantProductsButtons;
    private ListView warehouseProductsList;
    private ListView listProducts;
    private ListView listLines;
    private TextView txtStatus;

    private final List<Operator> operators = new ArrayList<Operator>();
    private final List<Operator> adminUsers = new ArrayList<Operator>();
    private final List<ProductRow> productRows = new ArrayList<ProductRow>();
    private final List<ProductRow> visibleProductRows = new ArrayList<ProductRow>();
    private final List<TaskItem> visibleTaskItems = new ArrayList<TaskItem>();
    private final List<OrderLine> orderLines = new ArrayList<OrderLine>();
    private final List<ShelfPositionInfo> shelfPositions = new ArrayList<ShelfPositionInfo>();
    private final Map<String, Article> articlesById = new HashMap<String, Article>();
    private final Map<String, String> categoryIconsByName = new HashMap<String, String>();
    private final Map<String, Double> reservationsKgByPosition = new HashMap<String, Double>();

    private ArrayAdapter<String> adminUsersAdapter;
    private ArrayAdapter<String> productsAdapter;
    private ArrayAdapter<String> linesAdapter;
    private ArrayAdapter<String> warehouseProductsAdapter;

    private String token = null;
    private String apiPort = API_PORT_SHADOW;
    private String API_URL = buildApiUrl();
    private long currentUserId = -1;
    private String currentUsername = null;
    private String activeModule = "instant";
    private String instantCategory = null;
    private String instantSubcategory = null;
    private String instantGroup = null;
    private String instantStep = STEP_CATEGORY;
    private String warehouseViewMode = "shelves";
    private String warehouseSectionCode = "A";
    private String warehouseCategory = null;
    private String warehouseSubcategory = null;
    private String warehouseGroup = null;
    private final List<String> warehouseSelectedGroupArticleIds = new ArrayList<String>();
    private String warehouseProductsStep = WAREHOUSE_STEP_CATEGORY;
    private String expandedWarehouseSector = null;
    private final List<ProductRow> visibleWarehouseRows = new ArrayList<ProductRow>();
    private volatile String lastInstantFingerprint = "";
    private volatile String lastTasksFingerprint = "";
    private volatile boolean forceInstantRefresh = true;
    private volatile boolean forceTasksRefresh = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
        hideSystemUi();
        setContentView(R.layout.activity_main);

        loadApiTargetPreference();
        bindViews();
        bindActions();
        showLoginScreen();
        hideKeyboard();
        loadOperators();
    }

    private void hideSystemUi() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        } else {
            getWindow().setFlags(
                android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN,
                android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN
            );
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
        startAutoRefresh();
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopAutoRefresh();
    }

    private void bindViews() {
        loginSection = findViewById(R.id.loginSection);
        dashboardSection = findViewById(R.id.dashboardSection);
        operatorGrid = (GridLayout) findViewById(R.id.operatorGrid);
        txtOperatorPrompt = (TextView) findViewById(R.id.txtOperatorPrompt);
        adminLoginPanel = (LinearLayout) findViewById(R.id.adminLoginPanel);
        adminUserSelect = (Spinner) findViewById(R.id.adminUserSelect);
        adminPasswordInput = (EditText) findViewById(R.id.adminPasswordInput);
        adminLoginBtn = (Button) findViewById(R.id.adminLoginBtn);
        btnApiTargetToggle = (Button) findViewById(R.id.btnApiTargetToggle);
        btnLoginRefresh = (Button) findViewById(R.id.btnLoginRefresh);
        txtLoginStatus = (TextView) findViewById(R.id.txtLoginStatus);
        txtCurrentOperator = (TextView) findViewById(R.id.txtCurrentOperator);
        btnTasks = (Button) findViewById(R.id.btnTasks);
        btnInstant = (Button) findViewById(R.id.btnInstant);
        btnWarehouse = (Button) findViewById(R.id.btnWarehouse);
        btnLogout = (Button) findViewById(R.id.btnLogout);
        btnWarehouseProductsView = (Button) findViewById(R.id.btnWarehouseProductsView);
        btnWarehouseShelvesView = (Button) findViewById(R.id.btnWarehouseShelvesView);
        btnSectorA = (Button) findViewById(R.id.btnSectorA);
        btnSectorB = (Button) findViewById(R.id.btnSectorB);
        btnSectorC = (Button) findViewById(R.id.btnSectorC);
        btnClearLines = (Button) findViewById(R.id.btnClearLines);
        btnConfirmOrder = (Button) findViewById(R.id.btnConfirmOrder);
        txtProductsTitle = (TextView) findViewById(R.id.txtProductsTitle);
        txtInstantStepHint = (TextView) findViewById(R.id.txtInstantStepHint);
        leftMainPanel = (LinearLayout) findViewById(R.id.leftMainPanel);
        rightOrderPanel = (LinearLayout) findViewById(R.id.rightOrderPanel);
        warehouseSection = (LinearLayout) findViewById(R.id.warehouseSection);
        warehouseSectorRow = (LinearLayout) findViewById(R.id.warehouseSectorRow);
        warehouseProductsPanel = (LinearLayout) findViewById(R.id.warehouseProductsPanel);
        warehouseShelvesPanel = (ScrollView) findViewById(R.id.warehouseShelvesPanel);
        warehouseCategoryRow = (LinearLayout) findViewById(R.id.warehouseCategoryRow);
        warehouseSubcategoryRow = (LinearLayout) findViewById(R.id.warehouseSubcategoryRow);
        warehousePositionsContainer = (LinearLayout) findViewById(R.id.warehousePositionsContainer);
        instantCategoryGrid = (LinearLayout) findViewById(R.id.instantCategoryGrid);
        instantSubcategoryGrid = (LinearLayout) findViewById(R.id.instantSubcategoryGrid);
        instantProductsScroll = (ScrollView) findViewById(R.id.instantProductsScroll);
        instantProductsButtons = (LinearLayout) findViewById(R.id.instantProductsButtons);
        warehouseProductsList = (ListView) findViewById(R.id.warehouseProductsList);
        listProducts = (ListView) findViewById(R.id.listProducts);
        listLines = (ListView) findViewById(R.id.listLines);

        adminUsersAdapter = new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, new ArrayList<String>());
        adminUsersAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        adminUserSelect.setAdapter(adminUsersAdapter);
        adminPasswordInput.clearFocus();
        adminPasswordInput.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, android.view.MotionEvent event) {
                if (event.getAction() == android.view.MotionEvent.ACTION_DOWN) {
                    adminPasswordInput.setFocusable(true);
                    adminPasswordInput.setFocusableInTouchMode(true);
                    adminPasswordInput.requestFocus();
                }
                return false;
            }
        });
        loginSection.requestFocus();

        productsAdapter = new ArrayAdapter<String>(this, R.layout.row_operatorlite_list_item, R.id.rowText, new ArrayList<String>());
        listProducts.setAdapter(productsAdapter);

        linesAdapter = new ArrayAdapter<String>(this, R.layout.row_operatorlite_list_item, R.id.rowText, new ArrayList<String>());
        listLines.setAdapter(linesAdapter);

        warehouseProductsAdapter = new ArrayAdapter<String>(this, R.layout.row_operatorlite_list_item, R.id.rowText, new ArrayList<String>());
        warehouseProductsList.setAdapter(warehouseProductsAdapter);

        updateApiTargetToggleLabel();
    }

    private void bindActions() {
        adminLoginBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                adminLogin();
            }
        });

        if (btnLoginRefresh != null) {
            btnLoginRefresh.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    loadOperators();
                }
            });
        }

        if (btnApiTargetToggle != null) {
            btnApiTargetToggle.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    toggleApiTarget();
                }
            });
        }

        btnTasks.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                activeModule = "tasks";
                updateModuleButtons();
                setStatus("");
                refreshProductsUi();
                loadAndShowTasksDialog();
            }
        });

        btnInstant.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                activeModule = "instant";
                updateModuleButtons();
                setStatus("");
                refreshProductsUi();
            }
        });

        btnWarehouse.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                activeModule = "warehouse";
                expandedWarehouseSector = null;
                updateModuleButtons();
                setStatus("");
                refreshProductsUi();
            }
        });

        btnLogout.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                handleLogout();
            }
        });

        btnWarehouseProductsView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                warehouseViewMode = "products";
                warehouseCategory = null;
                warehouseSubcategory = null;
                warehouseGroup = null;
                warehouseSelectedGroupArticleIds.clear();
                warehouseProductsStep = WAREHOUSE_STEP_CATEGORY;
                renderWarehouseSection();
            }
        });

        btnWarehouseShelvesView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                warehouseViewMode = "shelves";
                expandedWarehouseSector = null;
                renderWarehouseSection();
            }
        });

        btnSectorA.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                warehouseSectionCode = "A";
                renderWarehouseSection();
            }
        });
        btnSectorB.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                warehouseSectionCode = "B";
                renderWarehouseSection();
            }
        });
        btnSectorC.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                warehouseSectionCode = "C";
                renderWarehouseSection();
            }
        });

        listProducts.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                if ("tasks".equals(activeModule)) {
                    if (position >= 0 && position < visibleTaskItems.size()) {
                        showTaskActionsDialog(visibleTaskItems.get(position));
                    }
                    return;
                }

                if (position >= 0 && position < visibleProductRows.size()) {
                    showInstantAddDialog(visibleProductRows.get(position));
                }
            }
        });

        listLines.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                if (position >= 0 && position < orderLines.size()) {
                    showOrderLineActionsDialog(position);
                }
            }
        });

        warehouseProductsList.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                if (position >= 0 && position < visibleWarehouseRows.size()) {
                    showWarehousePositionsDialog(visibleWarehouseRows.get(position));
                }
            }
        });

        btnClearLines.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                orderLines.clear();
                refreshOrderLinesUi();
            }
        });

        btnConfirmOrder.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                confirmInstantOrder();
            }
        });
    }

    private void quickLoginOperator(final Operator op) {
        setStatus(getString(R.string.status_login, op.username));
        setLoginStatus(getString(R.string.status_login, op.username));

        runInBackground(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONObject body = new JSONObject();
                    body.put("operatorId", op.id);
                    JSONObject res = httpPostJson(API_URL + "/auth/quick-login", body, null);
                    token = res.optString("token", null);
                    JSONObject userObj = res.optJSONObject("user");
                    currentUserId = userObj != null ? userObj.optLong("id", -1) : -1;

                    if (token == null || token.trim().isEmpty()) {
                        throw new IOException("Token mancante");
                    }

                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            setStatus(getString(R.string.status_logged, op.username));
                            setLoginStatus(getString(R.string.status_logged, op.username));
                            currentUsername = op.username;
                            showDashboardScreen(op.username);
                            loadInstantData();
                        }
                    });
                } catch (final Exception ex) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            setStatus(getString(R.string.status_error, ex.getMessage()));
                            setLoginStatus(getString(R.string.status_error, ex.getMessage()));
                            toast(getString(R.string.login_error, ex.getMessage()));
                        }
                    });
                }
            }
        });
    }

    private void adminLogin() {
        final int idx = adminUserSelect.getSelectedItemPosition();
        if (idx < 0 || idx >= adminUsers.size()) {
            toast(R.string.admin_select_required);
            return;
        }
        final String pwd = adminPasswordInput.getText() != null ? adminPasswordInput.getText().toString() : "";
        if (pwd.trim().isEmpty()) {
            toast(R.string.admin_password_required);
            return;
        }

        final Operator admin = adminUsers.get(idx);
        setLoginStatus(getString(R.string.status_login, admin.username));

        runInBackground(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONObject body = new JSONObject();
                    body.put("username", admin.username);
                    body.put("password", pwd);
                    JSONObject res = httpPostJson(API_URL + "/auth/login", body, null);
                    JSONObject userObj = res.optJSONObject("user");
                    String role = userObj != null ? userObj.optString("role", "") : "";
                    String roleLower = role == null ? "" : role.toLowerCase(Locale.ROOT);
                    if (!("admin".equals(roleLower) || "master".equals(roleLower))) {
                        throw new IOException(getString(R.string.admin_not_authorized));
                    }

                    token = res.optString("token", null);
                    currentUserId = userObj != null ? userObj.optLong("id", -1) : -1;
                    currentUsername = userObj != null ? userObj.optString("username", admin.username) : admin.username;
                    if (token == null || token.trim().isEmpty()) {
                        throw new IOException(getString(R.string.admin_invalid));
                    }

                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            adminPasswordInput.setText("");
                            setLoginStatus(getString(R.string.status_logged, currentUsername));
                            showDashboardScreen(currentUsername);
                            loadInstantData();
                        }
                    });
                } catch (final Exception ex) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            toast(getString(R.string.admin_invalid));
                            setLoginStatus(getString(R.string.status_error, ex.getMessage()));
                        }
                    });
                }
            }
        });
    }

    private void loadOperators() {
        setStatus(getString(R.string.status_loading_operators));
        setLoginStatus(getString(R.string.status_loading_operators));
        updateLoginAvailabilityUi(true);

        runInBackground(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONArray arr = httpGetArray(API_URL + "/auth/operators/public", null);
                    final List<Operator> loaded = new ArrayList<Operator>();
                    final List<Operator> loadedAdmins = new ArrayList<Operator>();
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject obj = arr.optJSONObject(i);
                        if (obj == null) continue;
                        String role = obj.optString("role", "").toLowerCase(Locale.ROOT);

                        Operator op = new Operator();
                        op.id = obj.optLong("id", -1);
                        op.username = obj.optString("username", "Operatore");
                        if (op.id <= 0) continue;

                        if ("operator".equals(role) || "slave".equals(role) || "utente".equals(role)) {
                            loaded.add(op);
                        }
                        if ("admin".equals(role) || "master".equals(role)) {
                            loadedAdmins.add(op);
                        }
                    }

                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            operators.clear();
                            operators.addAll(loaded);
                            adminUsers.clear();
                            adminUsers.addAll(loadedAdmins);
                            renderOperatorGrid();
                            renderAdminUsers();

                            if (operators.isEmpty()) {
                                setStatus(getString(R.string.status_no_operators));
                                setLoginStatus(getString(R.string.status_no_operators));
                            } else {
                                setStatus(getString(R.string.status_ready_login));
                                setLoginStatus(getString(R.string.status_ready_login));
                            }
                            updateLoginAvailabilityUi(true);
                        }
                    });
                } catch (final Exception ex) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            operators.clear();
                            adminUsers.clear();
                            renderOperatorGrid();
                            renderAdminUsers();
                            updateLoginAvailabilityUi(false);
                            setStatus(getString(R.string.status_server_unavailable));
                            setLoginStatus(getString(R.string.status_server_unavailable));
                            toast(getString(R.string.operators_error, ex.getMessage()));
                        }
                    });
                }
            }
        });
    }

    private void updateLoginAvailabilityUi(boolean serverAvailable) {
        boolean hasOperators = serverAvailable && !operators.isEmpty();
        boolean hasAdmins = serverAvailable && !adminUsers.isEmpty();

        if (txtOperatorPrompt != null) {
            txtOperatorPrompt.setVisibility(hasOperators ? View.VISIBLE : View.GONE);
        }
        if (operatorGrid != null) {
            operatorGrid.setVisibility(hasOperators ? View.VISIBLE : View.GONE);
        }
        if (adminLoginPanel != null) {
            adminLoginPanel.setVisibility(hasAdmins ? View.VISIBLE : View.GONE);
        }
        if (btnLoginRefresh != null) {
            btnLoginRefresh.setText(getString(R.string.login_refresh));
            btnLoginRefresh.setVisibility(serverAvailable ? View.GONE : View.VISIBLE);
        }
    }

    private void renderOperatorGrid() {
        if (operatorGrid == null) return;
        operatorGrid.removeAllViews();

        int columns = operators.size() >= 6 ? 3 : 2;
        operatorGrid.setColumnCount(columns);

        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int horizontalPaddingPx = dp(80);
        int gapPx = dp(10);
        int available = Math.max(dp(200), screenWidth - horizontalPaddingPx);
        int itemWidth = Math.max(dp(160), (available - (columns - 1) * gapPx) / columns);

        for (final Operator op : operators) {
            Button btn = new Button(this);
            btn.setText(op.username);
            btn.setAllCaps(true);
            btn.setTextColor(0xFFFFFFFF);
            btn.setTextSize(18f);
            btn.setBackgroundResource(R.drawable.bg_operator_tile);

            GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
            lp.width = itemWidth;
            lp.height = dp(70);
            lp.setMargins(0, 0, gapPx, gapPx);
            btn.setLayoutParams(lp);

            btn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    quickLoginOperator(op);
                }
            });

            operatorGrid.addView(btn);
        }
    }

    private void showLoginScreen() {
        stopAutoRefresh();
        if (loginSection != null) loginSection.setVisibility(View.VISIBLE);
        if (dashboardSection != null) dashboardSection.setVisibility(View.GONE);
        updateApiTargetToggleLabel();
        if (txtCurrentOperator != null) txtCurrentOperator.setText("Operatore");
        if (adminPasswordInput != null) adminPasswordInput.clearFocus();
        if (loginSection != null) loginSection.requestFocus();
        hideKeyboard();
    }

    private String buildApiUrl() {
        return API_SCHEME + "://" + API_HOST + ":" + apiPort + "/api";
    }

    private void loadApiTargetPreference() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String savedPort = prefs.getString(PREF_API_PORT, API_PORT_SHADOW);
        if (!API_PORT_PROD.equals(savedPort) && !API_PORT_SHADOW.equals(savedPort)) {
            savedPort = API_PORT_SHADOW;
        }
        apiPort = savedPort;
        API_URL = buildApiUrl();
    }

    private void saveApiTargetPreference() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit().putString(PREF_API_PORT, apiPort).apply();
    }

    private void updateApiTargetToggleLabel() {
        if (btnApiTargetToggle == null) return;
        boolean prod = API_PORT_PROD.equals(apiPort);
        String label = prod ? "Endpoint: PRODUZIONE (:5000)" : "Endpoint: SHADOW (:5001)";
        btnApiTargetToggle.setText(label);
        btnApiTargetToggle.setBackgroundResource(prod ? R.drawable.bg_toolbar_button_green : R.drawable.bg_toolbar_button_dark);
    }

    private void toggleApiTarget() {
        apiPort = API_PORT_PROD.equals(apiPort) ? API_PORT_SHADOW : API_PORT_PROD;
        API_URL = buildApiUrl();
        saveApiTargetPreference();
        updateApiTargetToggleLabel();
        toast("Endpoint attivo: " + apiPort);
    }

    private void showDashboardScreen(String username) {
        if (loginSection != null) loginSection.setVisibility(View.GONE);
        if (dashboardSection != null) dashboardSection.setVisibility(View.VISIBLE);
        if (txtCurrentOperator != null) txtCurrentOperator.setText("Operatore: " + username);
        forceInstantRefresh = true;
        forceTasksRefresh = true;
        activeModule = "instant";
        if (instantCategory == null) {
            instantStep = STEP_CATEGORY;
        }
        updateModuleButtons();
        applyModuleLayout();
        setStatus("");
        refreshProductsUi();
        startAutoRefresh();
    }

    private void renderAdminUsers() {
        adminUsersAdapter.clear();
        for (Operator op : adminUsers) {
            adminUsersAdapter.add(op.username);
        }
        adminUsersAdapter.notifyDataSetChanged();
    }

    private void updateModuleButtons() {
        if (btnTasks != null) {
            btnTasks.setBackgroundResource("tasks".equals(activeModule) ? R.drawable.bg_toolbar_button_green : R.drawable.bg_toolbar_button_dark);
        }
        if (btnInstant != null) {
            btnInstant.setBackgroundResource("instant".equals(activeModule) ? R.drawable.bg_toolbar_button_orange : R.drawable.bg_toolbar_button_dark);
        }
        if (btnWarehouse != null) {
            btnWarehouse.setBackgroundResource("warehouse".equals(activeModule) ? R.drawable.bg_toolbar_button_red : R.drawable.bg_toolbar_button_dark);
        }
        if (btnWarehouseProductsView != null) {
            btnWarehouseProductsView.setBackgroundResource("products".equals(warehouseViewMode) ? R.drawable.bg_toolbar_button_orange : R.drawable.bg_toolbar_button_dark);
        }
        if (btnWarehouseShelvesView != null) {
            btnWarehouseShelvesView.setBackgroundResource("shelves".equals(warehouseViewMode) ? R.drawable.bg_toolbar_button_orange : R.drawable.bg_toolbar_button_dark);
        }
        if (btnSectorA != null) btnSectorA.setBackgroundResource("A".equals(warehouseSectionCode) ? R.drawable.bg_toolbar_button_orange : R.drawable.bg_toolbar_button_dark);
        if (btnSectorB != null) btnSectorB.setBackgroundResource("B".equals(warehouseSectionCode) ? R.drawable.bg_toolbar_button_orange : R.drawable.bg_toolbar_button_dark);
        if (btnSectorC != null) btnSectorC.setBackgroundResource("C".equals(warehouseSectionCode) ? R.drawable.bg_toolbar_button_orange : R.drawable.bg_toolbar_button_dark);
    }

    private void applyModuleLayout() {
        if (leftMainPanel == null || rightOrderPanel == null || warehouseSection == null) return;

        LinearLayout.LayoutParams leftLp = (LinearLayout.LayoutParams) leftMainPanel.getLayoutParams();
        if ("warehouse".equals(activeModule)) {
            leftMainPanel.setVisibility(View.VISIBLE);
            rightOrderPanel.setVisibility(View.GONE);
            leftLp.weight = 1f;
            warehouseSection.setVisibility(View.VISIBLE);
        } else if ("tasks".equals(activeModule)) {
            leftMainPanel.setVisibility(View.VISIBLE);
            rightOrderPanel.setVisibility(View.GONE);
            leftLp.weight = 1f;
            warehouseSection.setVisibility(View.GONE);
        } else {
            leftMainPanel.setVisibility(View.VISIBLE);
            rightOrderPanel.setVisibility(View.VISIBLE);
            leftLp.weight = 1.9f;
            warehouseSection.setVisibility(View.GONE);
        }
        leftMainPanel.setLayoutParams(leftLp);
    }

    private void handleLogout() {
        stopAutoRefresh();
        token = null;
        currentUserId = -1;
        currentUsername = null;
        lastInstantFingerprint = "";
        lastTasksFingerprint = "";
        forceInstantRefresh = true;
        forceTasksRefresh = true;
        activeModule = "instant";
        instantCategory = null;
        instantSubcategory = null;
        instantGroup = null;
        instantStep = STEP_CATEGORY;
        warehouseViewMode = "shelves";
        warehouseCategory = null;
        warehouseSubcategory = null;
        warehouseGroup = null;
        warehouseProductsStep = WAREHOUSE_STEP_CATEGORY;
        expandedWarehouseSector = null;
        orderLines.clear();
        productRows.clear();
        visibleProductRows.clear();
        articlesById.clear();
        refreshOrderLinesUi();
        refreshProductsUi();
        showLoginScreen();
        loadOperators();
    }

    private void loadInstantData() {
        if (token == null || token.trim().isEmpty()) {
            toast(R.string.login_required);
            return;
        }

        setStatus(getString(R.string.status_loading_products));

        runInBackground(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONArray articleArr = httpGetArray(API_URL + "/inventory/articles", token);
                    JSONArray entriesArr = httpGetArray(API_URL + "/inventory/shelf-entries", token);
                    JSONArray positionsArr = httpGetArraySafe(API_URL + "/inventory/shelf-positions", token);
                    JSONArray pendingOrdersArr = httpGetArraySafe(API_URL + "/orders?status=pending", token);
                    JSONArray inProgressOrdersArr = httpGetArraySafe(API_URL + "/orders?status=in_progress", token);
                    final JSONArray categoriesArr = httpGetArraySafe(API_URL + "/categories", token);
                    String incomingFingerprint = buildJsonFingerprint(
                        articleArr,
                        entriesArr,
                        positionsArr,
                        pendingOrdersArr,
                        inProgressOrdersArr,
                        categoriesArr
                    );

                    if (!forceInstantRefresh && incomingFingerprint.equals(lastInstantFingerprint)) {
                        return;
                    }

                    Map<String, Article> localArticles = parseArticles(articleArr);
                    List<ShelfEntry> shelfEntries = parseShelfEntries(entriesArr);
                    List<ProductRow> rows = aggregateRows(localArticles, shelfEntries);
                    final List<ShelfPositionInfo> localShelfPositions = parseShelfPositions(positionsArr);
                    final Map<String, String> localCategoryIcons = parseCategoryIcons(categoriesArr);
                    final Map<String, Double> localReservations = parseReservationsByPosition(pendingOrdersArr, inProgressOrdersArr);
                    final String newFingerprint = incomingFingerprint;

                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            articlesById.clear();
                            articlesById.putAll(localArticles);
                            categoryIconsByName.clear();
                            categoryIconsByName.putAll(localCategoryIcons);
                            reservationsKgByPosition.clear();
                            reservationsKgByPosition.putAll(localReservations);

                            productRows.clear();
                            productRows.addAll(rows);
                            shelfPositions.clear();
                            shelfPositions.addAll(localShelfPositions);
                            lastInstantFingerprint = newFingerprint;
                            forceInstantRefresh = false;
                            refreshProductsUi();
                            setStatus(getString(R.string.status_products_loaded, productRows.size()));
                        }
                    });
                } catch (final Exception ex) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            setStatus(getString(R.string.status_error, ex.getMessage()));
                            toast(getString(R.string.products_error, ex.getMessage()));
                        }
                    });
                }
            }
        });
    }

    private Map<String, Article> parseArticles(JSONArray articleArr) {
        Map<String, Article> map = new HashMap<String, Article>();
        for (int i = 0; i < articleArr.length(); i++) {
            JSONObject obj = articleArr.optJSONObject(i);
            if (obj == null) continue;
            String id = normalizeId(obj.opt("id"));
            if (id.isEmpty()) id = normalizeId(obj.opt("articleId"));
            if (id.isEmpty()) continue;

            Article a = new Article();
            a.id = id;
            a.code = normalizeOptionalText(obj.optString("code", ""));
            a.name = normalizeOptionalText(obj.optString("name", "Articolo " + id));
            a.category = normalizeOptionalText(obj.optString("category", ""));
            a.subcategory = normalizeOptionalText(obj.optString("subcategory", ""));
            a.productGroup = normalizeOptionalText(obj.optString("productGroup", ""));
            map.put(id, a);
        }
        return map;
    }

    private Map<String, Double> parseReservationsByPosition(JSONArray... ordersArrays) {
        Map<String, Double> out = new HashMap<String, Double>();
        if (ordersArrays == null) return out;

        for (JSONArray ordersArr : ordersArrays) {
            if (ordersArr == null) continue;
            for (int i = 0; i < ordersArr.length(); i++) {
                JSONObject order = ordersArr.optJSONObject(i);
                if (order == null) continue;
                JSONArray products = order.optJSONArray("products");
                if (products == null) continue;

                for (int j = 0; j < products.length(); j++) {
                    JSONObject product = products.optJSONObject(j);
                    if (product == null) continue;

                    String articleCode = normalizeOptionalText(product.optString("product", ""));
                    String batch = normalizeOptionalText(product.optString("batch", ""));
                    String shelfPosition = normalizeOptionalText(product.optString("shelfPosition", ""));
                    double quantityKg = safeJsonDouble(product.opt("quantity"), 0d);
                    if (articleCode.isEmpty() || shelfPosition.isEmpty() || quantityKg <= 0d) continue;

                    String key = buildReservationKey(articleCode, batch, shelfPosition);
                    double current = out.containsKey(key) ? out.get(key) : 0d;
                    out.put(key, current + quantityKg);
                }
            }
        }

        return out;
    }

    private List<ShelfEntry> parseShelfEntries(JSONArray entriesArr) {
        List<ShelfEntry> out = new ArrayList<ShelfEntry>();
        for (int i = 0; i < entriesArr.length(); i++) {
            JSONObject obj = entriesArr.optJSONObject(i);
            if (obj == null) continue;

            String articleId = normalizeId(obj.opt("articleId"));
            if (articleId.isEmpty()) articleId = normalizeId(obj.opt("article_id"));
            if (articleId.isEmpty()) continue;

            int qty = obj.optInt("quantity", 0);
            if (qty <= 0) continue;

            ShelfEntry se = new ShelfEntry();
            se.id = obj.optLong("id", -1);
            se.articleId = articleId;
            se.positionCode = normalizeOptionalText(obj.optString("positionCode", "-"));
            if (se.positionCode.isEmpty()) se.positionCode = "-";
            se.batch = normalizeOptionalText(obj.optString("batch", ""));
            se.expiry = normalizeOptionalText(obj.optString("expiry", ""));
            se.quantity = qty;
            out.add(se);
        }
        return out;
    }

    private List<ShelfPositionInfo> parseShelfPositions(JSONArray positionsArr) {
        List<ShelfPositionInfo> out = new ArrayList<ShelfPositionInfo>();
        if (positionsArr == null) return out;

        for (int i = 0; i < positionsArr.length(); i++) {
            JSONObject obj = positionsArr.optJSONObject(i);
            if (obj == null) continue;

            String code = obj.optString("code", "").trim();
            if (code.isEmpty()) continue;

            ShelfPositionInfo sp = new ShelfPositionInfo();
            sp.code = code;
            sp.description = normalizeOptionalText(obj.optString("description", ""));
            sp.isActive = obj.optBoolean("isActive", true);
            out.add(sp);
        }
        return out;
    }

    private List<ProductRow> aggregateRows(Map<String, Article> articleMap, List<ShelfEntry> entries) {
        Map<String, ProductRow> rowMap = new HashMap<String, ProductRow>();
        for (ShelfEntry se : entries) {
            Article art = articleMap.get(se.articleId);
            if (art == null) continue;

            ProductRow row = rowMap.get(se.articleId);
            if (row == null) {
                row = new ProductRow();
                row.articleId = se.articleId;
                row.code = art.code;
                row.name = art.name;
                row.category = normalizeCategory(art);
                row.subcategory = normalizeSubcategory(art);
                row.productGroup = normalizeProductGroup(art);
                row.weightPerCollo = parseWeightPerCollo(art.code, art.name);
                row.total = 0;
                row.entries = new ArrayList<ShelfEntry>();
                rowMap.put(se.articleId, row);
            }
            row.total += se.quantity;
            row.entries.add(se);
        }

        List<ProductRow> rows = new ArrayList<ProductRow>(rowMap.values());
        for (ProductRow row : rows) {
            if (row.entries == null) continue;
            Collections.sort(row.entries, new Comparator<ShelfEntry>() {
                @Override
                public int compare(ShelfEntry a, ShelfEntry b) {
                    String ap = a == null || a.positionCode == null ? "" : a.positionCode;
                    String bp = b == null || b.positionCode == null ? "" : b.positionCode;
                    int posCompare = ap.compareToIgnoreCase(bp);
                    if (posCompare != 0) return posCompare;
                    String ab = a == null || a.batch == null ? "" : a.batch;
                    String bb = b == null || b.batch == null ? "" : b.batch;
                    return ab.compareToIgnoreCase(bb);
                }
            });
        }
        Collections.sort(rows, new Comparator<ProductRow>() {
            @Override
            public int compare(ProductRow a, ProductRow b) {
                int w = Double.compare(a.weightPerCollo, b.weightPerCollo);
                if (w != 0) return w;
                return a.name.compareToIgnoreCase(b.name);
            }
        });
        return rows;
    }

    private Map<String, String> parseCategoryIcons(JSONArray categoriesArr) {
        Map<String, String> out = new HashMap<String, String>();
        if (categoriesArr == null) return out;

        for (int i = 0; i < categoriesArr.length(); i++) {
            JSONObject obj = categoriesArr.optJSONObject(i);
            if (obj == null) continue;
            String name = obj.optString("name", "").trim();
            String icon = obj.optString("icon", "").trim();
            if (name.isEmpty() || icon.isEmpty()) continue;
            out.put(name.toUpperCase(Locale.ROOT), icon);
        }
        return out;
    }

    private void refreshProductsUi() {
        applyModuleLayout();

        if ("tasks".equals(activeModule)) {
            if (txtProductsTitle != null) {
                txtProductsTitle.setVisibility(View.VISIBLE);
                txtProductsTitle.setText("Task operatore");
            }
            if (txtInstantStepHint != null) {
                txtInstantStepHint.setVisibility(View.VISIBLE);
                txtInstantStepHint.setText("Tocca un task per le azioni");
            }
            if (listProducts != null) listProducts.setVisibility(View.GONE);
            if (instantCategoryGrid != null) instantCategoryGrid.setVisibility(View.GONE);
            if (instantSubcategoryGrid != null) instantSubcategoryGrid.setVisibility(View.GONE);
            if (warehouseSection != null) warehouseSection.setVisibility(View.GONE);
            renderInlineTaskBoard();
            return;
        }

        if (instantProductsButtons != null) {
            instantProductsButtons.removeAllViews();
        }
        if (instantProductsScroll != null) {
            instantProductsScroll.setVisibility(View.GONE);
        }

        if ("warehouse".equals(activeModule)) {
            if (listProducts != null) listProducts.setVisibility(View.GONE);
            if (instantCategoryGrid != null) instantCategoryGrid.setVisibility(View.GONE);
            if (instantSubcategoryGrid != null) instantSubcategoryGrid.setVisibility(View.GONE);
            if (instantProductsScroll != null) instantProductsScroll.setVisibility(View.GONE);
            if (txtProductsTitle != null) txtProductsTitle.setVisibility(View.GONE);
            if (txtInstantStepHint != null) txtInstantStepHint.setVisibility(View.GONE);
            if (warehouseSection != null) warehouseSection.setVisibility(View.GONE);
            renderWarehouseSection();
            return;
        }

        if (txtProductsTitle != null) txtProductsTitle.setVisibility(View.VISIBLE);
        if (txtInstantStepHint != null) txtInstantStepHint.setVisibility(View.VISIBLE);
        if (listProducts != null) listProducts.setVisibility(View.GONE);

        sanitizeInstantSelection();

        renderInstantCategoryChips();
        renderInstantSubcategoryChips();
        renderInstantProductButtons();

        List<ProductRow> filtered = new ArrayList<ProductRow>();
        for (ProductRow row : productRows) {
            if (instantCategory != null && !instantCategory.equals(row.category)) continue;
            if (instantSubcategory != null && !instantSubcategory.equals(row.subcategory)) continue;
            if (instantGroup != null && !instantGroup.equals(normalizeGroupKey(row.productGroup))) continue;
            filtered.add(row);
        }

        productsAdapter.clear();
        visibleProductRows.clear();
        visibleProductRows.addAll(filtered);

        if (STEP_CATEGORY.equals(instantStep)) {
            txtProductsTitle.setText(getString(R.string.instant_step_category_title));
            txtInstantStepHint.setText(getString(R.string.instant_step_category_hint));
        } else if (STEP_SUBCATEGORY.equals(instantStep)) {
            txtProductsTitle.setText(getString(R.string.instant_step_subcategory_title, instantCategory));
            txtInstantStepHint.setText(getString(R.string.instant_step_subcategory_hint));
        } else if (STEP_GROUP.equals(instantStep)) {
            txtProductsTitle.setText(getString(R.string.instant_step_group_title, instantCategory, instantSubcategory));
            txtInstantStepHint.setText(getString(R.string.instant_step_group_hint));
        } else {
            txtProductsTitle.setText(getString(R.string.products_title_fmt_group, instantCategory, instantSubcategory, getGroupDisplayLabel(instantGroup)));
            txtInstantStepHint.setText(getString(R.string.instant_step_products_hint));
        }

        for (ProductRow row : filtered) {
            productsAdapter.add(row.name + "\n" + row.code + " • " + row.total + " colli");
        }
        if (filtered.isEmpty() && STEP_PRODUCTS.equals(instantStep)) {
            productsAdapter.add("Nessun prodotto disponibile");
        }
        productsAdapter.notifyDataSetChanged();
    }

    private void renderInlineTaskBoard() {
        if (instantProductsScroll == null || instantProductsButtons == null) return;

        instantProductsButtons.removeAllViews();

        if (visibleTaskItems.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText("Nessun task disponibile");
            empty.setTextColor(0xFFD1D5DB);
            empty.setTextSize(18f);
            empty.setPadding(dp(10), dp(12), dp(10), dp(12));
            instantProductsButtons.addView(empty);
            instantProductsScroll.setVisibility(View.VISIBLE);
            return;
        }

        for (TaskItem task : visibleTaskItems) {
            if (task == null) continue;
            View card = buildTaskBoardCard(task, null);
            LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            cardLp.setMargins(0, 0, 0, dp(10));
            card.setLayoutParams(cardLp);
            instantProductsButtons.addView(card);
        }

        instantProductsScroll.setVisibility(View.VISIBLE);
    }

    private void sanitizeInstantSelection() {
        if (STEP_CATEGORY.equals(instantStep)) {
            instantCategory = null;
            instantSubcategory = null;
            instantGroup = null;
            return;
        }

        if (instantCategory == null) {
            instantStep = STEP_CATEGORY;
            instantSubcategory = null;
            instantGroup = null;
            return;
        }

        boolean categoryExists = false;
        for (ProductRow row : productRows) {
            if (instantCategory.equals(row.category)) {
                categoryExists = true;
                break;
            }
        }
        if (!categoryExists) {
            instantStep = STEP_CATEGORY;
            instantCategory = null;
            instantSubcategory = null;
            instantGroup = null;
            return;
        }

        if (instantSubcategory == null && (STEP_GROUP.equals(instantStep) || STEP_PRODUCTS.equals(instantStep))) {
            instantStep = STEP_SUBCATEGORY;
            instantGroup = null;
            return;
        }

        if (instantSubcategory != null) {
            boolean subExists = false;
            for (ProductRow row : productRows) {
                if (instantCategory.equals(row.category) && instantSubcategory.equals(row.subcategory)) {
                    subExists = true;
                    break;
                }
            }
            if (!subExists) {
                instantStep = STEP_SUBCATEGORY;
                instantSubcategory = null;
                instantGroup = null;
                return;
            }
        }

        if (instantGroup != null) {
            boolean groupExists = false;
            for (ProductRow row : productRows) {
                if (!instantCategory.equals(row.category)) continue;
                if (!instantSubcategory.equals(row.subcategory)) continue;
                if (instantGroup.equals(normalizeGroupKey(row.productGroup))) {
                    groupExists = true;
                    break;
                }
            }
            if (!groupExists) {
                instantStep = STEP_GROUP;
                instantGroup = null;
            }
        }
    }

    private void renderInstantCategoryChips() {
        if (instantCategoryGrid == null) return;
        instantCategoryGrid.removeAllViews();

        if (!STEP_CATEGORY.equals(instantStep)) {
            instantCategoryGrid.setVisibility(View.GONE);
            return;
        }
        instantCategoryGrid.setVisibility(View.VISIBLE);

        List<String> categories = new ArrayList<String>();
        for (ProductRow row : productRows) {
            if (!categories.contains(row.category)) categories.add(row.category);
        }

        List<Button> buttons = new ArrayList<Button>();
        for (final String cat : categories) {
            Button chip = buildChip(cat, false);
            chip.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    instantCategory = cat;
                    instantSubcategory = null;
                    instantGroup = null;
                    instantStep = STEP_SUBCATEGORY;
                    refreshProductsUi();
                }
            });
            buttons.add(chip);
        }
        addButtonsInTwoColumns(instantCategoryGrid, buttons);
    }

    private void renderInstantSubcategoryChips() {
        if (instantSubcategoryGrid == null) return;
        instantSubcategoryGrid.removeAllViews();

        if (!STEP_SUBCATEGORY.equals(instantStep) && !STEP_GROUP.equals(instantStep)) {
            instantSubcategoryGrid.setVisibility(View.GONE);
            return;
        }
        instantSubcategoryGrid.setVisibility(View.VISIBLE);

        if (STEP_GROUP.equals(instantStep)) {
            Button backToSubcategories = buildChip(getString(R.string.instant_back_subcategories), true);
            LinearLayout.LayoutParams backLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            backLp.setMargins(0, 0, 0, dp(12));
            backToSubcategories.setLayoutParams(backLp);
            backToSubcategories.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    instantStep = STEP_SUBCATEGORY;
                    instantGroup = null;
                    refreshProductsUi();
                }
            });
            instantSubcategoryGrid.addView(backToSubcategories);

            List<String> groups = new ArrayList<String>();
            for (ProductRow row : productRows) {
                if (instantCategory == null || !instantCategory.equals(row.category)) continue;
                if (instantSubcategory == null || !instantSubcategory.equals(row.subcategory)) continue;
                String groupKey = normalizeGroupKey(row.productGroup);
                if (!groups.contains(groupKey)) groups.add(groupKey);
            }

            List<Button> groupButtons = new ArrayList<Button>();
            for (final String groupKey : groups) {
                Button chip = buildChip(getGroupDisplayLabel(groupKey), groupKey.equals(instantGroup));
                chip.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        instantGroup = groupKey;
                        instantStep = STEP_PRODUCTS;
                        refreshProductsUi();
                    }
                });
                groupButtons.add(chip);
            }
            addButtonsInTwoColumns(instantSubcategoryGrid, groupButtons);
            return;
        }

        Button backToCategories = buildChip(getString(R.string.instant_back_categories), true);
        LinearLayout.LayoutParams backLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        backLp.setMargins(0, 0, 0, dp(12));
        backToCategories.setLayoutParams(backLp);
        backToCategories.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                instantStep = STEP_CATEGORY;
                instantCategory = null;
                instantSubcategory = null;
                instantGroup = null;
                refreshProductsUi();
            }
        });
        instantSubcategoryGrid.addView(backToCategories);

        List<String> subcats = new ArrayList<String>();
        for (ProductRow row : productRows) {
            if (instantCategory == null || !instantCategory.equals(row.category)) continue;
            if (!subcats.contains(row.subcategory)) subcats.add(row.subcategory);
        }

        List<Button> buttons = new ArrayList<Button>();
        for (final String sub : subcats) {
            Button chip = buildChip(sub, sub.equals(instantSubcategory));
            chip.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    instantSubcategory = sub;
                    instantGroup = null;
                    instantStep = STEP_GROUP;
                    refreshProductsUi();
                }
            });
            buttons.add(chip);
        }
        addButtonsInTwoColumns(instantSubcategoryGrid, buttons);
    }

    private void renderInstantProductButtons() {
        if (instantProductsScroll == null || instantProductsButtons == null) return;

        if (!STEP_PRODUCTS.equals(instantStep)) {
            instantProductsButtons.removeAllViews();
            instantProductsScroll.setVisibility(View.GONE);
            return;
        }

        instantProductsButtons.removeAllViews();

        Button backToSubcategories = buildChip(getString(R.string.instant_back_subcategories), true);
        backToSubcategories.setTextSize(20f);
        backToSubcategories.setMinHeight(dp(70));
        backToSubcategories.setMinimumHeight(dp(70));
        LinearLayout.LayoutParams backLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        backLp.setMargins(0, 0, 0, dp(10));
        backToSubcategories.setLayoutParams(backLp);
        backToSubcategories.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                instantStep = STEP_GROUP;
                refreshProductsUi();
            }
        });
        instantProductsButtons.addView(backToSubcategories);

        List<ProductRow> filtered = new ArrayList<ProductRow>();
        for (ProductRow row : productRows) {
            if (instantCategory == null || !instantCategory.equals(row.category)) continue;
            if (instantSubcategory == null || !instantSubcategory.equals(row.subcategory)) continue;
            if (instantGroup == null || !instantGroup.equals(normalizeGroupKey(row.productGroup))) continue;
            filtered.add(row);
        }

        if (filtered.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText(getString(R.string.instant_no_products));
            empty.setTextColor(0xFFD1D5DB);
            empty.setTextSize(18f);
            empty.setPadding(dp(10), dp(10), dp(10), dp(10));
            LinearLayout.LayoutParams emptyLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            emptyLp.setMargins(0, 0, 0, dp(10));
            empty.setLayoutParams(emptyLp);
            instantProductsButtons.addView(empty);
        } else {
            List<Button> productButtons = new ArrayList<Button>();
            for (final ProductRow row : filtered) {
                Button productBtn = new Button(this);
                productBtn.setAllCaps(false);
                productBtn.setTextColor(0xFFFFFFFF);
                productBtn.setTextSize(22f);
                productBtn.setBackgroundResource(R.drawable.bg_toolbar_button_dark);
                productBtn.setMinHeight(dp(82));
                productBtn.setMinimumHeight(dp(82));
                productBtn.setPadding(dp(16), dp(12), dp(16), dp(12));
                productBtn.setText(getCategoryIcon(row.category) + " " + row.name + "\n" + row.code + " • " + row.total + " colli");

                productBtn.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        showInstantAddDialog(row);
                    }
                });
                productButtons.add(productBtn);
            }
            addButtonsInTwoColumns(instantProductsButtons, productButtons);
        }

        instantProductsScroll.setVisibility(View.VISIBLE);
    }

    private void hideKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm == null) return;
        View target = getCurrentFocus();
        if (target == null && adminPasswordInput != null) {
            target = adminPasswordInput;
        }
        if (target != null && target.getWindowToken() != null) {
            imm.hideSoftInputFromWindow(target.getWindowToken(), 0);
        }
    }

    private Button buildChip(String text, boolean active) {
        Button chip = new Button(this);
        boolean isBackChip = text.startsWith("<");
        String chipText = text;
        if (!isBackChip) {
            chipText = getCategoryIcon(instantCategory != null && !STEP_CATEGORY.equals(instantStep) ? instantCategory : text) + " " + text;
        }
        chip.setText(chipText);
        chip.setTextColor(0xFFFFFFFF);
        chip.setTextSize(22f);
        chip.setAllCaps(false);
        chip.setMinHeight(dp(86));
        chip.setMinimumHeight(dp(86));
        chip.setPadding(dp(18), dp(14), dp(18), dp(14));
        chip.setBackgroundResource(active ? R.drawable.bg_chip_active : R.drawable.bg_chip);
        if (isBackChip) {
            chip.setCompoundDrawablesWithIntrinsicBounds(android.R.drawable.ic_media_previous, 0, 0, 0);
            chip.setCompoundDrawablePadding(dp(8));
        }
        return chip;
    }

    private Button buildWarehouseFilterButton(String text, boolean active) {
        Button btn = new Button(this);
        btn.setText(text);
        btn.setTextColor(0xFFFFFFFF);
        btn.setTextSize(16f);
        btn.setAllCaps(false);
        btn.setMinHeight(dp(58));
        btn.setMinimumHeight(dp(58));
        btn.setPadding(dp(14), dp(10), dp(14), dp(10));
        btn.setBackgroundResource(active ? R.drawable.bg_toolbar_button_orange : R.drawable.bg_toolbar_button_dark);
        return btn;
    }

    private void addButtonsInTwoColumns(LinearLayout container, List<Button> buttons) {
        if (container == null || buttons == null || buttons.isEmpty()) return;

        for (int i = 0; i < buttons.size(); i += 2) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            rowLp.setMargins(0, 0, 0, dp(10));
            row.setLayoutParams(rowLp);

            Button left = buttons.get(i);
            LinearLayout.LayoutParams leftLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            leftLp.setMargins(0, 0, dp(6), 0);
            left.setLayoutParams(leftLp);
            row.addView(left);

            if (i + 1 < buttons.size()) {
                Button right = buttons.get(i + 1);
                LinearLayout.LayoutParams rightLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                rightLp.setMargins(dp(6), 0, 0, 0);
                right.setLayoutParams(rightLp);
                row.addView(right);
            } else {
                View spacer = new View(this);
                LinearLayout.LayoutParams spacerLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                spacer.setLayoutParams(spacerLp);
                row.addView(spacer);
            }

            container.addView(row);
        }
    }

    private void addViewsInThreeColumns(LinearLayout container, List<View> views) {
        if (container == null || views == null || views.isEmpty()) return;

        for (int i = 0; i < views.size(); i += 3) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            rowLp.setMargins(0, 0, 0, dp(10));
            row.setLayoutParams(rowLp);

            for (int j = 0; j < 3; j++) {
                if (i + j < views.size()) {
                    View v = views.get(i + j);
                    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                    if (j == 0) lp.setMargins(0, 0, dp(4), 0);
                    else if (j == 1) lp.setMargins(dp(4), 0, dp(4), 0);
                    else lp.setMargins(dp(4), 0, 0, 0);
                    v.setLayoutParams(lp);
                    row.addView(v);
                } else {
                    View spacer = new View(this);
                    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                    if (j == 0) lp.setMargins(0, 0, dp(4), 0);
                    else if (j == 1) lp.setMargins(dp(4), 0, dp(4), 0);
                    else lp.setMargins(dp(4), 0, 0, 0);
                    spacer.setLayoutParams(lp);
                    row.addView(spacer);
                }
            }

            container.addView(row);
        }
    }

    private GradientDrawable roundedDrawable(int fillColor, int strokeColor, int strokeDp, int radiusDp) {
        GradientDrawable d = new GradientDrawable();
        d.setShape(GradientDrawable.RECTANGLE);
        d.setCornerRadius(dp(radiusDp));
        d.setColor(fillColor);
        d.setStroke(dp(strokeDp), strokeColor);
        return d;
    }

    private void styleDialogButtons(AlertDialog dialog) {
        if (dialog == null) return;

        Button positive = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
        if (positive != null) {
            positive.setTextColor(0xFFFFFFFF);
            positive.setBackgroundDrawable(roundedDrawable(0xFF16A34A, 0xFF15803D, 1, 6));
            positive.setAllCaps(false);
            positive.setTextSize(17f);
        }

        Button negative = dialog.getButton(AlertDialog.BUTTON_NEGATIVE);
        if (negative != null) {
            negative.setTextColor(0xFFFFFFFF);
            negative.setBackgroundDrawable(roundedDrawable(0xFFB91C1C, 0xFF991B1B, 1, 6));
            negative.setAllCaps(false);
            negative.setTextSize(17f);
        }

        Button neutral = dialog.getButton(AlertDialog.BUTTON_NEUTRAL);
        if (neutral != null) {
            neutral.setTextColor(0xFFFFFFFF);
            neutral.setBackgroundDrawable(roundedDrawable(0xFF1E3A8A, 0xFF1D4ED8, 1, 6));
            neutral.setAllCaps(false);
            neutral.setTextSize(17f);
        }
    }

    private void styleDialogWindowTop(AlertDialog dialog, int minWidthDp, int minHeightDp) {
        if (dialog == null || dialog.getWindow() == null) return;
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        int dialogWidth = Math.max(dp(minWidthDp), screenWidth - dp(10));
        int dialogHeight = Math.max(dp(minHeightDp), screenHeight - dp(20));
        dialog.getWindow().setLayout(dialogWidth, dialogHeight);
        dialog.getWindow().setGravity(Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        dialog.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }

    private void styleDialogField(EditText field) {
        if (field == null) return;
        field.setTextColor(0xFFFFFFFF);
        field.setHintTextColor(0xFF94A3B8);
        field.setTextSize(18f);
        field.setTypeface(Typeface.DEFAULT_BOLD);
        field.setPadding(dp(10), dp(8), dp(10), dp(8));
        field.setBackgroundDrawable(roundedDrawable(0xFF1F2937, 0xFF334155, 1, 6));
    }

    private void styleDialogSpinner(Spinner spinner) {
        if (spinner == null) return;
        spinner.setBackgroundDrawable(roundedDrawable(0xFF1F2937, 0xFF334155, 1, 6));
        spinner.setPadding(dp(8), dp(6), dp(8), dp(6));
    }

    private View buildWarehouseEntryCard(final WarehouseEntryItem it) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(8), dp(8), dp(8), dp(8));
        card.setBackgroundDrawable(roundedDrawable(0xFF374151, 0xFF4F46E5, 1, 5));

        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);

        TextView name = new TextView(this);
        name.setText((it.articleName == null ? "ARTICOLO" : it.articleName).toUpperCase(Locale.ROOT));
        name.setTextColor(0xFFFFFFFF);
        name.setTextSize(19f);
        name.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams nameLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        name.setLayoutParams(nameLp);
        top.addView(name);

        TextView qty = new TextView(this);
        qty.setText(String.valueOf(Math.max(0, it.quantity)));
        qty.setTextColor(0xFFEFFDF5);
        qty.setTextSize(16f);
        qty.setTypeface(Typeface.DEFAULT_BOLD);
        qty.setPadding(dp(8), dp(3), dp(8), dp(3));
        qty.setBackgroundDrawable(roundedDrawable(0xFF2F9E63, 0x00000000, 0, 4));
        top.addView(qty);

        card.addView(top);

        TextView code = new TextView(this);
        code.setText(it.articleCode == null ? "-" : it.articleCode);
        code.setTextColor(0xFFCBD5E1);
        code.setTextSize(16f);
        code.setPadding(0, dp(2), 0, 0);
        card.addView(code);

        String batch = (it.batch == null || it.batch.trim().isEmpty()) ? "-" : it.batch.trim();
        TextView lot = new TextView(this);
        lot.setText("🏷 " + batch);
        lot.setTextColor(0xFFF59E0B);
        lot.setTextSize(16f);
        lot.setPadding(0, dp(2), 0, 0);
        card.addView(lot);

        String expiry = (it.expiry == null || it.expiry.trim().isEmpty()) ? "-" : it.expiry.trim();
        TextView exp = new TextView(this);
        exp.setText("📅 " + expiry);
        exp.setTextColor(0xFF60A5FA);
        exp.setTextSize(16f);
        exp.setPadding(0, dp(1), 0, dp(2));
        card.addView(exp);

        if (it.reservedQuantity > 0) {
            TextView reserved = new TextView(this);
            reserved.setText("🔒 " + it.reservedQuantity + " prenotati");
            reserved.setTextColor(0xFFFFB46A);
            reserved.setTextSize(15f);
            reserved.setTypeface(Typeface.DEFAULT_BOLD);
            reserved.setPadding(dp(8), dp(4), dp(8), dp(4));
            reserved.setBackgroundDrawable(roundedDrawable(0xFF5D1B08, 0x00000000, 0, 4));
            LinearLayout.LayoutParams reservedLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            reservedLp.setMargins(0, dp(4), 0, dp(4));
            reserved.setLayoutParams(reservedLp);
            card.addView(reserved);
        }

        TextView available = new TextView(this);
        available.setText("✅ " + Math.max(0, it.availableQuantity) + " disponibili");
        available.setTextColor(it.availableQuantity <= 0 ? 0xFFFCA5A5 : 0xFF4ADE80);
        available.setTextSize(15f);
        available.setTypeface(Typeface.DEFAULT_BOLD);
        available.setPadding(0, 0, 0, dp(4));
        card.addView(available);

        LinearLayout actionRow = new LinearLayout(this);
        actionRow.setOrientation(LinearLayout.HORIZONTAL);

        Button bEdit = new Button(this);
        bEdit.setText("✏");
        bEdit.setTextSize(15f);
        bEdit.setTextColor(0xFFFFFFFF);
        bEdit.setAllCaps(false);
        bEdit.setBackgroundDrawable(roundedDrawable(0xFF2563EB, 0x00000000, 0, 4));
        LinearLayout.LayoutParams aLp = new LinearLayout.LayoutParams(0, dp(32), 1f);
        aLp.setMargins(0, 0, dp(4), 0);
        bEdit.setLayoutParams(aLp);
        bEdit.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showWarehouseEditEntryDialog(it);
            }
        });
        actionRow.addView(bEdit);

        Button bCopy = new Button(this);
        bCopy.setText("📋");
        bCopy.setTextSize(15f);
        bCopy.setTextColor(0xFFFFFFFF);
        bCopy.setAllCaps(false);
        bCopy.setBackgroundDrawable(roundedDrawable(0xFF7C3AED, 0x00000000, 0, 4));
        LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(0, dp(32), 1f);
        cLp.setMargins(0, 0, dp(4), 0);
        bCopy.setLayoutParams(cLp);
        bCopy.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showWarehouseCopyEntryDialog(it);
            }
        });
        actionRow.addView(bCopy);

        Button bDel = new Button(this);
        bDel.setText("🗑");
        bDel.setTextSize(15f);
        bDel.setTextColor(0xFFFFFFFF);
        bDel.setAllCaps(false);
        bDel.setBackgroundDrawable(roundedDrawable(0xFFEF4444, 0x00000000, 0, 4));
        LinearLayout.LayoutParams dLp = new LinearLayout.LayoutParams(0, dp(32), 1f);
        bDel.setLayoutParams(dLp);
        bDel.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showWarehouseDeleteEntryDialog(it);
            }
        });
        actionRow.addView(bDel);

        card.addView(actionRow);
        return card;
    }

    private View buildWarehousePositionCard(final String posCode, String description, final List<WarehouseEntryItem> items) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(8), dp(8), dp(8), dp(8));

        boolean occupied = items != null && !items.isEmpty();
        card.setBackgroundDrawable(roundedDrawable(0xFF3F3F46, occupied ? 0xFF22C55E : 0xFF52525B, 2, 6));

        TextView badge = new TextView(this);
        badge.setText(posCode == null ? "-" : posCode);
        badge.setTextColor(0xFF93C5FD);
        badge.setTextSize(22f);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setPadding(dp(9), dp(4), dp(9), dp(4));
        badge.setBackgroundDrawable(roundedDrawable(0xFF334155, 0x00000000, 0, 4));
        card.addView(badge);

        String cleanDescription = normalizeOptionalText(description);
        if (!cleanDescription.isEmpty()) {
            TextView desc = new TextView(this);
            desc.setText(cleanDescription);
            desc.setTextColor(0xFF9CA3AF);
            desc.setTextSize(16f);
            desc.setPadding(0, dp(4), 0, dp(4));
            card.addView(desc);
        }

        if (!occupied) {
            TextView empty = new TextView(this);
            empty.setText("📭 Posizione vuota\nClicca per assegnare");
            empty.setTextColor(0xFF9CA3AF);
            empty.setTextSize(16f);
            empty.setPadding(0, dp(14), 0, dp(14));
            card.addView(empty);
        } else {
            int max = Math.min(2, items.size());
            for (int i = 0; i < max; i++) {
                View entryCard = buildWarehouseEntryCard(items.get(i));
                LinearLayout.LayoutParams ep = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                );
                ep.setMargins(0, 0, 0, dp(6));
                entryCard.setLayoutParams(ep);
                card.addView(entryCard);
            }
        }

        Button addBtn = new Button(this);
        addBtn.setAllCaps(false);
        addBtn.setText("+ Aggiungi prodotto");
        addBtn.setTextColor(0xFFFFFFFF);
        addBtn.setTextSize(19f);
        addBtn.setTypeface(Typeface.DEFAULT_BOLD);
        addBtn.setBackgroundDrawable(roundedDrawable(0xFF16A34A, 0x00000000, 0, 5));
        LinearLayout.LayoutParams addLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(44)
        );
        addLp.setMargins(0, dp(2), 0, 0);
        addBtn.setLayoutParams(addLp);
        addBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showWarehouseAddProductDialog(posCode);
            }
        });
        card.addView(addBtn);

        return card;
    }

    private String buildWarehousePositionLabel(String posCode, String description, List<WarehouseEntryItem> items) {
        StringBuilder sb = new StringBuilder();
        sb.append(posCode == null ? "-" : posCode);
        String cleanDescription = normalizeOptionalText(description);
        if (!cleanDescription.isEmpty()) {
            sb.append("\n").append(cleanDescription);
        }

        if (items == null || items.isEmpty()) {
            sb.append("\n\nPOSIZIONE VUOTA");
            sb.append("\nClicca per assegnare");
            return sb.toString();
        }

        int total = 0;
        int reserved = 0;
        for (WarehouseEntryItem it : items) {
            total += it.availableQuantity;
            reserved += it.reservedQuantity;
        }
        sb.append("\n\n").append(total).append(" colli disp. • ").append(items.size()).append(" articoli");
        if (reserved > 0) {
            sb.append("\n").append(reserved).append(" prenotati");
        }

        int preview = Math.min(2, items.size());
        for (int i = 0; i < preview; i++) {
            WarehouseEntryItem it = items.get(i);
            String name = it.articleName == null ? "Articolo" : it.articleName;
            if (name.length() > 20) name = name.substring(0, 20) + "...";
            sb.append("\n").append(name.toUpperCase(Locale.ROOT));
            sb.append(" • ").append(it.availableQuantity).append(" disp.");
            if (it.reservedQuantity > 0) sb.append(" • ").append(it.reservedQuantity).append(" pren.");
            if (it.batch != null && !it.batch.trim().isEmpty()) sb.append(" • L.").append(it.batch.trim());
            if (it.expiry != null && !it.expiry.trim().isEmpty()) sb.append(" ").append(it.expiry.trim());
        }
        if (items.size() > preview) {
            sb.append("\n+").append(items.size() - preview).append(" altri articoli");
        }

        return sb.toString();
    }

    private List<String> getActiveWarehousePositionCodes(String excludeCode) {
        List<String> out = new ArrayList<String>();
        for (ShelfPositionInfo sp : shelfPositions) {
            if (sp == null || sp.code == null) continue;
            if (!sp.isActive) continue;
            String code = sp.code.trim();
            if (code.isEmpty()) continue;
            if (excludeCode != null && excludeCode.equals(code)) continue;
            out.add(code);
        }
        Collections.sort(out);
        return out;
    }

    private String normalizeOptionalText(String value) {
        if (value == null) return "";
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return "";
        if ("null".equalsIgnoreCase(trimmed)) return "";
        return trimmed;
    }

    private String buildReservationKey(String articleCode, String batch, String positionCode) {
        return normalizeOptionalText(articleCode) + "|" + normalizeOptionalText(batch) + "|" + normalizeOptionalText(positionCode);
    }

    private double safeJsonDouble(Object value, double fallback) {
        if (value == null || value == JSONObject.NULL) return fallback;
        if (value instanceof Number) return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value).replace(',', '.').trim());
        } catch (Exception ex) {
            return fallback;
        }
    }

    private int toReservedColli(double reservedKg, double weightPerUnit) {
        if (reservedKg <= 0d) return 0;
        double unit = weightPerUnit > 0d ? weightPerUnit : 1d;
        return Math.max(0, (int) Math.round(reservedKg / unit));
    }

    private void showWarehouseEditEntryDialog(final WarehouseEntryItem item) {
        if (item == null || item.shelfEntryId <= 0) {
            toast("Entry non modificabile");
            return;
        }

        ScrollView rootScroll = new ScrollView(this);
        rootScroll.setFillViewport(true);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(14), dp(10), dp(14), dp(8));
        rootScroll.addView(layout, new ScrollView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        TextView helper = new TextView(this);
        helper.setText("Aggiorna i dettagli del prodotto");
        helper.setTextColor(0xFF94A3B8);
        helper.setTextSize(17f);
        helper.setPadding(0, 0, 0, dp(10));
        layout.addView(helper);

        LinearLayout fieldsRow = new LinearLayout(this);
        fieldsRow.setOrientation(LinearLayout.HORIZONTAL);
        fieldsRow.setWeightSum(3f);
        LinearLayout.LayoutParams fieldsRowLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        fieldsRowLp.setMargins(0, 0, 0, dp(8));
        fieldsRow.setLayoutParams(fieldsRowLp);
        layout.addView(fieldsRow);

        LinearLayout quantityCard = new LinearLayout(this);
        quantityCard.setOrientation(LinearLayout.VERTICAL);
        quantityCard.setPadding(dp(10), dp(10), dp(10), dp(10));
        quantityCard.setBackgroundDrawable(roundedDrawable(0xFF111827, 0xFF16A34A, 1, 7));
        LinearLayout.LayoutParams quantityCardLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        quantityCardLp.setMargins(0, 0, dp(6), 0);
        quantityCard.setLayoutParams(quantityCardLp);
        fieldsRow.addView(quantityCard);

        TextView quantityLabel = new TextView(this);
        quantityLabel.setText("QUANTITA");
        quantityLabel.setTextColor(0xFF86EFAC);
        quantityLabel.setTextSize(15f);
        quantityLabel.setTypeface(Typeface.DEFAULT_BOLD);
        quantityLabel.setPadding(0, 0, 0, dp(6));
        quantityCard.addView(quantityLabel);

        final EditText qtyInput = new EditText(this);
        qtyInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        qtyInput.setHint("Colli");
        qtyInput.setText(String.valueOf(Math.max(0, item.quantity)));
        qtyInput.setTextColor(0xFFFFFFFF);
        qtyInput.setHintTextColor(0xFF94A3B8);
        qtyInput.setTextSize(20f);
        qtyInput.setTypeface(Typeface.DEFAULT_BOLD);
        qtyInput.setBackgroundColor(0x00000000);
        qtyInput.setPadding(0, 0, 0, 0);
        quantityCard.addView(qtyInput);

        LinearLayout batchCard = new LinearLayout(this);
        batchCard.setOrientation(LinearLayout.VERTICAL);
        batchCard.setPadding(dp(10), dp(10), dp(10), dp(10));
        batchCard.setBackgroundDrawable(roundedDrawable(0xFF111827, 0xFFF59E0B, 1, 7));
        LinearLayout.LayoutParams batchCardLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        batchCardLp.setMargins(0, 0, dp(6), 0);
        batchCard.setLayoutParams(batchCardLp);
        fieldsRow.addView(batchCard);

        TextView batchLabel = new TextView(this);
        batchLabel.setText("LOTTO");
        batchLabel.setTextColor(0xFFFCD34D);
        batchLabel.setTextSize(15f);
        batchLabel.setTypeface(Typeface.DEFAULT_BOLD);
        batchLabel.setPadding(0, 0, 0, dp(6));
        batchCard.addView(batchLabel);

        final EditText batchInput = new EditText(this);
        batchInput.setInputType(InputType.TYPE_CLASS_TEXT);
        batchInput.setHint("Lotto");
        batchInput.setText(item.batch == null ? "" : item.batch);
        batchInput.setTextColor(0xFFFFFFFF);
        batchInput.setHintTextColor(0xFF94A3B8);
        batchInput.setTextSize(18f);
        batchInput.setTypeface(Typeface.DEFAULT_BOLD);
        batchInput.setBackgroundColor(0x00000000);
        batchInput.setPadding(0, 0, 0, 0);
        batchCard.addView(batchInput);

        LinearLayout expiryCard = new LinearLayout(this);
        expiryCard.setOrientation(LinearLayout.VERTICAL);
        expiryCard.setPadding(dp(10), dp(10), dp(10), dp(10));
        expiryCard.setBackgroundDrawable(roundedDrawable(0xFF111827, 0xFF38BDF8, 1, 7));
        LinearLayout.LayoutParams expiryCardLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        expiryCard.setLayoutParams(expiryCardLp);
        fieldsRow.addView(expiryCard);

        TextView expiryLabel = new TextView(this);
        expiryLabel.setText("SCADENZA");
        expiryLabel.setTextColor(0xFF7DD3FC);
        expiryLabel.setTextSize(15f);
        expiryLabel.setTypeface(Typeface.DEFAULT_BOLD);
        expiryLabel.setPadding(0, 0, 0, dp(6));
        expiryCard.addView(expiryLabel);

        final EditText expiryInput = new EditText(this);
        expiryInput.setInputType(InputType.TYPE_CLASS_TEXT);
        expiryInput.setHint("Scadenza");
        expiryInput.setText(item.expiry == null ? "" : item.expiry);
        expiryInput.setTextColor(0xFFFFFFFF);
        expiryInput.setHintTextColor(0xFF94A3B8);
        expiryInput.setTextSize(18f);
        expiryInput.setTypeface(Typeface.DEFAULT_BOLD);
        expiryInput.setBackgroundColor(0x00000000);
        expiryInput.setPadding(0, 0, 0, 0);
        expiryCard.addView(expiryInput);

        final AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle("Modifica prodotto in " + item.positionCode)
            .setView(rootScroll)
            .setPositiveButton("Salva", null)
            .setNegativeButton(R.string.cancel, null)
            .create();

        dlg.show();
        styleDialogButtons(dlg);
        styleDialogWindowTop(dlg, 640, 420);
        Button ok = dlg.getButton(AlertDialog.BUTTON_POSITIVE);
        if (ok != null) {
            ok.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    int qty;
                    try {
                        qty = Integer.parseInt(qtyInput.getText().toString().trim());
                    } catch (Exception ex) {
                        qty = 0;
                    }
                    if (qty < 0) {
                        toast("Quantita non valida");
                        return;
                    }

                    final int qtyFinal = qty;
                    final String batch = batchInput.getText() == null ? "" : batchInput.getText().toString().trim();
                    final String expiry = expiryInput.getText() == null ? "" : expiryInput.getText().toString().trim();

                    runInBackground(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                JSONObject body = new JSONObject();
                                body.put("quantity", qtyFinal);
                                body.put("batch", batch.isEmpty() ? JSONObject.NULL : batch);
                                body.put("expiry", expiry.isEmpty() ? JSONObject.NULL : expiry);
                                body.put("notes", JSONObject.NULL);
                                body.put("positionCode", item.positionCode);
                                httpRequest(API_URL + "/inventory/shelf-entries/" + item.shelfEntryId, "PUT", body.toString(), token);
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        dlg.dismiss();
                                        toast("Posizione aggiornata");
                                        loadInstantData();
                                    }
                                });
                            } catch (final Exception ex) {
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        toast("Errore modifica: " + ex.getMessage());
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }
    }

    private void showWarehouseCopyEntryDialog(final WarehouseEntryItem item) {
        if (item == null || item.articleId == null || item.articleId.trim().isEmpty()) {
            toast("Entry non copiabile");
            return;
        }

        final List<String> targets = getActiveWarehousePositionCodes(null);
        if (targets.isEmpty()) {
            toast("Nessuna posizione di destinazione disponibile");
            return;
        }

        ScrollView rootScroll = new ScrollView(this);
        rootScroll.setFillViewport(true);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(14), dp(10), dp(14), dp(8));
        rootScroll.addView(layout, new ScrollView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        String initialTarget = "";
        for (String candidate : targets) {
            if (candidate == null) continue;
            if (!candidate.equals(item.positionCode)) {
                initialTarget = candidate;
                break;
            }
        }
        if (initialTarget.isEmpty()) {
            initialTarget = targets.get(0);
        }
        final String[] selectedTarget = new String[] { initialTarget };

        TextView helper = new TextView(this);
        helper.setText("Scegli posizione e dettagli di copia");
        helper.setTextColor(0xFF94A3B8);
        helper.setTextSize(17f);
        helper.setPadding(0, 0, 0, dp(10));
        layout.addView(helper);

        final LinearLayout fieldsRow = new LinearLayout(this);
        fieldsRow.setOrientation(LinearLayout.HORIZONTAL);
        fieldsRow.setWeightSum(4f);
        LinearLayout.LayoutParams fieldsRowLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        fieldsRowLp.setMargins(0, 0, 0, dp(10));
        fieldsRow.setLayoutParams(fieldsRowLp);
        layout.addView(fieldsRow);

        final LinearLayout positionCard = new LinearLayout(this);
        positionCard.setOrientation(LinearLayout.VERTICAL);
        positionCard.setPadding(dp(10), dp(10), dp(10), dp(10));
        positionCard.setBackgroundDrawable(roundedDrawable(0xFF111827, 0xFF2563EB, 1, 7));
        LinearLayout.LayoutParams positionCardLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        positionCardLp.setMargins(0, 0, dp(6), 0);
        positionCard.setLayoutParams(positionCardLp);
        fieldsRow.addView(positionCard);

        TextView positionLabel = new TextView(this);
        positionLabel.setText("POSIZIONE DESTINAZIONE");
        positionLabel.setTextColor(0xFF93C5FD);
        positionLabel.setTextSize(15f);
        positionLabel.setTypeface(Typeface.DEFAULT_BOLD);
        positionLabel.setPadding(0, 0, 0, dp(6));
        positionCard.addView(positionLabel);

        final Button selectedLabel = new Button(this);
        selectedLabel.setAllCaps(false);
        selectedLabel.setText("Posizione: " + selectedTarget[0] + "  ▼");
        selectedLabel.setTextColor(0xFFBFDBFE);
        selectedLabel.setTextSize(18f);
        selectedLabel.setTypeface(Typeface.DEFAULT_BOLD);
        selectedLabel.setPadding(dp(10), dp(8), dp(10), dp(8));
        selectedLabel.setGravity(Gravity.LEFT | Gravity.CENTER_VERTICAL);
        selectedLabel.setBackgroundDrawable(roundedDrawable(0xFF1F2937, 0xFF334155, 1, 5));
        LinearLayout.LayoutParams selectedLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        selectedLabel.setLayoutParams(selectedLp);
        positionCard.addView(selectedLabel);

        final LinearLayout quantityCard = new LinearLayout(this);
        quantityCard.setOrientation(LinearLayout.VERTICAL);
        quantityCard.setPadding(dp(10), dp(10), dp(10), dp(10));
        quantityCard.setBackgroundDrawable(roundedDrawable(0xFF111827, 0xFF16A34A, 1, 7));
        LinearLayout.LayoutParams quantityCardLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        quantityCardLp.setMargins(0, 0, dp(6), 0);
        quantityCard.setLayoutParams(quantityCardLp);
        fieldsRow.addView(quantityCard);

        TextView quantityLabel = new TextView(this);
        quantityLabel.setText("QUANTITA DA COPIARE");
        quantityLabel.setTextColor(0xFF86EFAC);
        quantityLabel.setTextSize(15f);
        quantityLabel.setTypeface(Typeface.DEFAULT_BOLD);
        quantityLabel.setPadding(0, 0, 0, dp(6));
        quantityCard.addView(quantityLabel);

        final EditText qtyInput = new EditText(this);
        qtyInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        qtyInput.setHint("Quantita disponibile da copiare");
        qtyInput.setText(String.valueOf(Math.max(0, item.availableQuantity)));
        qtyInput.setTextColor(0xFFFFFFFF);
        qtyInput.setHintTextColor(0xFF94A3B8);
        qtyInput.setTextSize(20f);
        qtyInput.setTypeface(Typeface.DEFAULT_BOLD);
        qtyInput.setBackgroundColor(0x00000000);
        qtyInput.setPadding(0, 0, 0, 0);
        quantityCard.addView(qtyInput);

        final LinearLayout batchCard = new LinearLayout(this);
        batchCard.setOrientation(LinearLayout.VERTICAL);
        batchCard.setPadding(dp(10), dp(10), dp(10), dp(10));
        batchCard.setBackgroundDrawable(roundedDrawable(0xFF111827, 0xFFF59E0B, 1, 7));
        LinearLayout.LayoutParams batchCardLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        batchCardLp.setMargins(0, 0, dp(6), 0);
        batchCard.setLayoutParams(batchCardLp);
        fieldsRow.addView(batchCard);

        TextView batchLabel = new TextView(this);
        batchLabel.setText("LOTTO");
        batchLabel.setTextColor(0xFFFCD34D);
        batchLabel.setTextSize(15f);
        batchLabel.setTypeface(Typeface.DEFAULT_BOLD);
        batchLabel.setPadding(0, 0, 0, dp(6));
        batchCard.addView(batchLabel);

        final EditText batchInput = new EditText(this);
        batchInput.setInputType(InputType.TYPE_CLASS_TEXT);
        batchInput.setHint("Lotto");
        batchInput.setText(item.batch == null ? "" : item.batch);
        batchInput.setTextColor(0xFFFFFFFF);
        batchInput.setHintTextColor(0xFF94A3B8);
        batchInput.setTextSize(18f);
        batchInput.setTypeface(Typeface.DEFAULT_BOLD);
        batchInput.setBackgroundColor(0x00000000);
        batchInput.setPadding(0, 0, 0, 0);
        batchCard.addView(batchInput);

        final LinearLayout expiryCard = new LinearLayout(this);
        expiryCard.setOrientation(LinearLayout.VERTICAL);
        expiryCard.setPadding(dp(10), dp(10), dp(10), dp(10));
        expiryCard.setBackgroundDrawable(roundedDrawable(0xFF111827, 0xFF38BDF8, 1, 7));
        LinearLayout.LayoutParams expiryCardLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        expiryCard.setLayoutParams(expiryCardLp);
        fieldsRow.addView(expiryCard);

        TextView expiryLabel = new TextView(this);
        expiryLabel.setText("SCADENZA");
        expiryLabel.setTextColor(0xFF7DD3FC);
        expiryLabel.setTextSize(15f);
        expiryLabel.setTypeface(Typeface.DEFAULT_BOLD);
        expiryLabel.setPadding(0, 0, 0, dp(6));
        expiryCard.addView(expiryLabel);

        final EditText expiryInput = new EditText(this);
        expiryInput.setInputType(InputType.TYPE_CLASS_TEXT);
        expiryInput.setHint("Scadenza");
        expiryInput.setText(item.expiry == null ? "" : item.expiry);
        expiryInput.setTextColor(0xFFFFFFFF);
        expiryInput.setHintTextColor(0xFF94A3B8);
        expiryInput.setTextSize(18f);
        expiryInput.setTypeface(Typeface.DEFAULT_BOLD);
        expiryInput.setBackgroundColor(0x00000000);
        expiryInput.setPadding(0, 0, 0, 0);
        expiryCard.addView(expiryInput);

        final AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle("Copia in altra posizione")
            .setView(rootScroll)
            .setPositiveButton("Copia", null)
            .setNegativeButton(R.string.cancel, null)
            .create();

        selectedLabel.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                hideKeyboard();
                showWarehouseCopyPositionPicker(dlg, targets, selectedTarget, selectedLabel, item.positionCode);
            }
        });

        dlg.show();
        styleDialogButtons(dlg);
        styleDialogWindowTop(dlg, 640, 420);
        Button ok = dlg.getButton(AlertDialog.BUTTON_POSITIVE);
        if (ok != null) {
            ok.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    int qty;
                    try {
                        qty = Integer.parseInt(qtyInput.getText().toString().trim());
                    } catch (Exception ex) {
                        qty = 0;
                    }
                    if (qty <= 0) {
                        toast("Quantita non valida");
                        return;
                    }

                    if (qty > item.availableQuantity) {
                        toast("Quantita superiore al disponibile");
                        return;
                    }

                    final String target = selectedTarget[0];
                    if (target != null && target.equals(item.positionCode)) {
                        toast("La posizione origine non e selezionabile");
                        return;
                    }
                    final String batch = batchInput.getText() == null ? "" : batchInput.getText().toString().trim();
                    final String expiry = expiryInput.getText() == null ? "" : expiryInput.getText().toString().trim();
                    final int qtyFinal = qty;

                    runInBackground(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                JSONObject body = new JSONObject();
                                body.put("articleId", Integer.parseInt(item.articleId));
                                body.put("positionCode", target);
                                body.put("quantity", qtyFinal);
                                body.put("batch", batch.isEmpty() ? JSONObject.NULL : batch);
                                body.put("expiry", expiry.isEmpty() ? JSONObject.NULL : expiry);
                                body.put("notes", JSONObject.NULL);
                                httpPostJson(API_URL + "/inventory/shelf-entries", body, token);
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        dlg.dismiss();
                                        toast("Prodotto copiato");
                                        loadInstantData();
                                    }
                                });
                            } catch (final Exception ex) {
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        toast("Errore copia: " + ex.getMessage());
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }
    }

    private void showWarehouseCopyPositionPicker(final AlertDialog parentDialog, List<String> targets, final String[] selectedTarget, final Button selectedLabel, final String sourcePositionCode) {
        if (targets == null || targets.isEmpty()) return;

        final AlertDialog[] pickerDialog = new AlertDialog[1];
        final boolean[] selectedFromPicker = new boolean[] { false };

        ScrollView rootScroll = new ScrollView(this);
        rootScroll.setFillViewport(true);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(10), dp(10), dp(10), dp(10));
        rootScroll.addView(layout, new ScrollView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        TextView title = new TextView(this);
        title.setText("Seleziona posizione");
        title.setTextColor(0xFFE2E8F0);
        title.setTextSize(21f);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setPadding(0, 0, 0, dp(8));
        layout.addView(title);

        TextView helper = new TextView(this);
        helper.setText("La posizione ORIGINE e evidenziata e non selezionabile");
        helper.setTextColor(0xFFFCD34D);
        helper.setTextSize(15f);
        helper.setTypeface(Typeface.DEFAULT_BOLD);
        helper.setPadding(0, 0, 0, dp(8));
        layout.addView(helper);

        final int gridColumns = 10;
        int pickerScreenWidth = getResources().getDisplayMetrics().widthPixels;
        int buttonGap = dp(3);
        int buttonWidth = Math.max(dp(54), (pickerScreenWidth - dp(18) - ((gridColumns - 1) * buttonGap)) / gridColumns);
        float baseTextSize = buttonWidth >= dp(70) ? 17f : (buttonWidth >= dp(62) ? 16f : 15f);

        LinearLayout rowsHolder = new LinearLayout(this);
        rowsHolder.setOrientation(LinearLayout.VERTICAL);

        final Pattern shelfPattern = Pattern.compile("^([A-Za-z])(\\d+)\\.(\\d+)$");
        Map<String, Map<Integer, List<String>>> bySectorByColumn = new HashMap<String, Map<Integer, List<String>>>();
        List<String> fallbackTargets = new ArrayList<String>();

        for (String raw : targets) {
            String target = raw == null ? "" : raw.trim();
            if (target.isEmpty()) continue;
            Matcher m = shelfPattern.matcher(target);
            if (!m.matches()) {
                fallbackTargets.add(target);
                continue;
            }

            String sector = m.group(1).toUpperCase(Locale.ROOT);
            int columnNumber;
            try {
                columnNumber = Integer.parseInt(m.group(2));
            } catch (Exception ex) {
                fallbackTargets.add(target);
                continue;
            }

            Map<Integer, List<String>> byColumn = bySectorByColumn.get(sector);
            if (byColumn == null) {
                byColumn = new HashMap<Integer, List<String>>();
                bySectorByColumn.put(sector, byColumn);
            }

            List<String> stack = byColumn.get(columnNumber);
            if (stack == null) {
                stack = new ArrayList<String>();
                byColumn.put(columnNumber, stack);
            }
            stack.add(target);
        }

        List<String> sectors = new ArrayList<String>(bySectorByColumn.keySet());
        Collections.sort(sectors);

        for (String sector : sectors) {
            TextView sectorLabel = new TextView(this);
            sectorLabel.setText("Settore " + sector);
            sectorLabel.setTextColor(0xFF93C5FD);
            sectorLabel.setTextSize(15f);
            sectorLabel.setTypeface(Typeface.DEFAULT_BOLD);
            sectorLabel.setPadding(0, dp(4), 0, dp(4));
            rowsHolder.addView(sectorLabel);

            Map<Integer, List<String>> byColumn = bySectorByColumn.get(sector);
            if (byColumn == null || byColumn.isEmpty()) continue;

            List<Integer> columns = new ArrayList<Integer>(byColumn.keySet());
            Collections.sort(columns);

            for (Integer columnNumber : columns) {
                List<String> stack = byColumn.get(columnNumber);
                if (stack == null || stack.isEmpty()) continue;
                Collections.sort(stack, new Comparator<String>() {
                    @Override
                    public int compare(String a, String b) {
                        Matcher ma = shelfPattern.matcher(a == null ? "" : a);
                        Matcher mb = shelfPattern.matcher(b == null ? "" : b);
                        int la = 0;
                        int lb = 0;
                        if (ma.matches()) {
                            try { la = Integer.parseInt(ma.group(3)); } catch (Exception ignored) {}
                        }
                        if (mb.matches()) {
                            try { lb = Integer.parseInt(mb.group(3)); } catch (Exception ignored) {}
                        }
                        return Integer.compare(lb, la);
                    }
                });
            }

            for (int rowStart = 0; rowStart < columns.size(); rowStart += gridColumns) {
                LinearLayout row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setWeightSum((float) gridColumns);
                LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                );
                if (rowStart > 0) {
                    rowLp.setMargins(0, dp(16), 0, 0);
                }
                row.setLayoutParams(rowLp);

                View startDivider = new View(this);
                LinearLayout.LayoutParams startDivLp = new LinearLayout.LayoutParams(dp(2), ViewGroup.LayoutParams.MATCH_PARENT);
                startDivLp.setMargins(0, 0, dp(2), buttonGap);
                startDivider.setLayoutParams(startDivLp);
                startDivider.setBackgroundColor(0xFF475569);
                row.addView(startDivider);

                for (int c = 0; c < gridColumns; c++) {
                    int idx = rowStart + c;
                    if (idx >= columns.size()) {
                        View spacer = new View(this);
                        LinearLayout.LayoutParams spLp = new LinearLayout.LayoutParams(0, dp(52), 1f);
                        if (c < gridColumns - 1) spLp.setMargins(0, 0, buttonGap, buttonGap);
                        else spLp.setMargins(0, 0, 0, buttonGap);
                        spacer.setLayoutParams(spLp);
                        row.addView(spacer);

                        View divider = new View(this);
                        LinearLayout.LayoutParams divLp = new LinearLayout.LayoutParams(dp(2), ViewGroup.LayoutParams.MATCH_PARENT);
                        divLp.setMargins(0, 0, dp(2), buttonGap);
                        divider.setLayoutParams(divLp);
                        divider.setBackgroundColor(0xFF475569);
                        row.addView(divider);
                        continue;
                    }

                    Integer columnNumber = columns.get(idx);
                    List<String> stack = byColumn.get(columnNumber);
                    if (stack == null || stack.isEmpty()) {
                        View spacer = new View(this);
                        LinearLayout.LayoutParams spLp = new LinearLayout.LayoutParams(0, dp(52), 1f);
                        if (c < gridColumns - 1) spLp.setMargins(0, 0, buttonGap, buttonGap);
                        else spLp.setMargins(0, 0, 0, buttonGap);
                        spacer.setLayoutParams(spLp);
                        row.addView(spacer);

                        View divider = new View(this);
                        LinearLayout.LayoutParams divLp = new LinearLayout.LayoutParams(dp(2), ViewGroup.LayoutParams.MATCH_PARENT);
                        divLp.setMargins(0, 0, dp(2), buttonGap);
                        divider.setLayoutParams(divLp);
                        divider.setBackgroundColor(0xFF475569);
                        row.addView(divider);
                        continue;
                    }

                    LinearLayout columnLayout = new LinearLayout(this);
                    columnLayout.setOrientation(LinearLayout.VERTICAL);
                    LinearLayout.LayoutParams colLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                    if (c < gridColumns - 1) colLp.setMargins(0, 0, buttonGap, buttonGap);
                    else colLp.setMargins(0, 0, 0, buttonGap);
                    columnLayout.setLayoutParams(colLp);

                    for (int si = 0; si < stack.size(); si++) {
                        final String target = stack.get(si);
                        final boolean isSource = sourcePositionCode != null && sourcePositionCode.equals(target);
                        final Button targetBtn = new Button(this);
                        targetBtn.setAllCaps(false);
                        targetBtn.setText(isSource ? (target + " ORIG") : target);
                        targetBtn.setSingleLine(true);
                        targetBtn.setGravity(Gravity.CENTER);
                        float textSize = target != null && target.length() >= 5 ? baseTextSize - 1f : baseTextSize;
                        targetBtn.setTextSize(textSize);
                        targetBtn.setTextColor(isSource ? 0xFFFEF3C7 : 0xFFFFFFFF);
                        targetBtn.setTypeface(Typeface.DEFAULT_BOLD);
                        targetBtn.setTag(target);
                        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            dp(52)
                        );
                        if (si < stack.size() - 1) btnLp.setMargins(0, 0, 0, buttonGap);
                        targetBtn.setLayoutParams(btnLp);
                        targetBtn.setPadding(dp(2), dp(2), dp(2), dp(2));
                        int fillColor;
                        if (isSource) {
                            fillColor = 0xFF7C2D12;
                        } else if (target.equals(selectedTarget[0])) {
                            fillColor = 0xFF2563EB;
                        } else {
                            fillColor = 0xFF1F2937;
                        }
                        int strokeColor = isSource ? 0xFFF59E0B : 0xFF334155;
                        targetBtn.setBackgroundDrawable(roundedDrawable(fillColor, strokeColor, 1, 5));
                        targetBtn.setEnabled(!isSource);
                        targetBtn.setOnClickListener(new View.OnClickListener() {
                            @Override
                            public void onClick(View v) {
                                selectedFromPicker[0] = true;
                                selectedTarget[0] = target;
                                selectedLabel.setText("Posizione: " + target + "  ▼");
                                if (parentDialog != null) {
                                    parentDialog.show();
                                    if (parentDialog.getWindow() != null) {
                                        int screenWidth = getResources().getDisplayMetrics().widthPixels;
                                        int screenHeight = getResources().getDisplayMetrics().heightPixels;
                                        int dialogWidth = Math.max(dp(640), screenWidth - dp(8));
                                        int dialogHeight = Math.max(dp(420), screenHeight - dp(16));
                                        parentDialog.getWindow().setLayout(dialogWidth, dialogHeight);
                                        parentDialog.getWindow().setGravity(Gravity.TOP | Gravity.CENTER_HORIZONTAL);
                                        parentDialog.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
                                    }
                                }
                                toast("Posizione selezionata: " + target);
                                if (pickerDialog[0] != null) {
                                    pickerDialog[0].dismiss();
                                }
                            }
                        });
                        columnLayout.addView(targetBtn);
                    }

                    row.addView(columnLayout);

                    View divider = new View(this);
                    LinearLayout.LayoutParams divLp = new LinearLayout.LayoutParams(dp(2), ViewGroup.LayoutParams.MATCH_PARENT);
                    divLp.setMargins(0, 0, dp(2), buttonGap);
                    divider.setLayoutParams(divLp);
                    divider.setBackgroundColor(0xFF475569);
                    row.addView(divider);
                }

                rowsHolder.addView(row);
            }
        }

        if (!fallbackTargets.isEmpty()) {
            TextView otherLabel = new TextView(this);
            otherLabel.setText("Altre posizioni");
            otherLabel.setTextColor(0xFF93C5FD);
            otherLabel.setTextSize(15f);
            otherLabel.setTypeface(Typeface.DEFAULT_BOLD);
            otherLabel.setPadding(0, dp(4), 0, dp(4));
            rowsHolder.addView(otherLabel);

            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            int colInRow = 0;
            row.setWeightSum((float) gridColumns);

            View startDivider = new View(this);
            LinearLayout.LayoutParams startDivLp = new LinearLayout.LayoutParams(dp(2), ViewGroup.LayoutParams.MATCH_PARENT);
            startDivLp.setMargins(0, 0, dp(2), buttonGap);
            startDivider.setLayoutParams(startDivLp);
            startDivider.setBackgroundColor(0xFF475569);
            row.addView(startDivider);

            for (int i = 0; i < fallbackTargets.size(); i++) {
                final String target = fallbackTargets.get(i);
                final boolean isSource = sourcePositionCode != null && sourcePositionCode.equals(target);
                final Button targetBtn = new Button(this);
                targetBtn.setAllCaps(false);
                targetBtn.setText(isSource ? (target + " ORIG") : target);
                targetBtn.setSingleLine(true);
                targetBtn.setGravity(Gravity.CENTER);
                targetBtn.setTextSize(baseTextSize - 1f);
                targetBtn.setTextColor(isSource ? 0xFFFEF3C7 : 0xFFFFFFFF);
                targetBtn.setTypeface(Typeface.DEFAULT_BOLD);
                LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(0, dp(52), 1f);
                if (colInRow < gridColumns - 1) btnLp.setMargins(0, 0, buttonGap, buttonGap);
                else btnLp.setMargins(0, 0, 0, buttonGap);
                targetBtn.setLayoutParams(btnLp);
                int fillColor;
                if (isSource) {
                    fillColor = 0xFF7C2D12;
                } else if (target.equals(selectedTarget[0])) {
                    fillColor = 0xFF2563EB;
                } else {
                    fillColor = 0xFF1F2937;
                }
                int strokeColor = isSource ? 0xFFF59E0B : 0xFF334155;
                targetBtn.setBackgroundDrawable(roundedDrawable(fillColor, strokeColor, 1, 5));
                targetBtn.setEnabled(!isSource);
                targetBtn.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        selectedFromPicker[0] = true;
                        selectedTarget[0] = target;
                        selectedLabel.setText("Posizione: " + target + "  ▼");
                        if (parentDialog != null) {
                            parentDialog.show();
                        }
                        if (pickerDialog[0] != null) {
                            pickerDialog[0].dismiss();
                        }
                    }
                });
                row.addView(targetBtn);

                View divider = new View(this);
                LinearLayout.LayoutParams divLp = new LinearLayout.LayoutParams(dp(2), ViewGroup.LayoutParams.MATCH_PARENT);
                divLp.setMargins(0, 0, dp(2), buttonGap);
                divider.setLayoutParams(divLp);
                divider.setBackgroundColor(0xFF475569);
                row.addView(divider);
                colInRow++;

                if (colInRow >= gridColumns && i < fallbackTargets.size() - 1) {
                    rowsHolder.addView(row);
                    row = new LinearLayout(this);
                    row.setOrientation(LinearLayout.HORIZONTAL);
                    row.setWeightSum((float) gridColumns);

                    View nextStartDivider = new View(this);
                    LinearLayout.LayoutParams nextStartDivLp = new LinearLayout.LayoutParams(dp(2), ViewGroup.LayoutParams.MATCH_PARENT);
                    nextStartDivLp.setMargins(0, 0, dp(2), buttonGap);
                    nextStartDivider.setLayoutParams(nextStartDivLp);
                    nextStartDivider.setBackgroundColor(0xFF475569);
                    row.addView(nextStartDivider);
                    colInRow = 0;
                }
            }

            while (colInRow < gridColumns) {
                View spacer = new View(this);
                LinearLayout.LayoutParams spLp = new LinearLayout.LayoutParams(0, dp(52), 1f);
                if (colInRow < gridColumns - 1) spLp.setMargins(0, 0, buttonGap, buttonGap);
                else spLp.setMargins(0, 0, 0, buttonGap);
                spacer.setLayoutParams(spLp);
                row.addView(spacer);

                View divider = new View(this);
                LinearLayout.LayoutParams divLp = new LinearLayout.LayoutParams(dp(2), ViewGroup.LayoutParams.MATCH_PARENT);
                divLp.setMargins(0, 0, dp(2), buttonGap);
                divider.setLayoutParams(divLp);
                divider.setBackgroundColor(0xFF475569);
                row.addView(divider);
                colInRow++;
            }
            rowsHolder.addView(row);
        }

        layout.addView(rowsHolder);
        pickerDialog[0] = new AlertDialog.Builder(this)
            .setTitle("Posizioni disponibili")
            .setView(rootScroll)
            .setNegativeButton(R.string.cancel, null)
            .create();

        if (parentDialog != null && parentDialog.isShowing()) {
            parentDialog.hide();
        }

        pickerDialog[0].show();
        styleDialogButtons(pickerDialog[0]);
        styleDialogWindowTop(pickerDialog[0], 680, 460);

        pickerDialog[0].setOnDismissListener(new android.content.DialogInterface.OnDismissListener() {
            @Override
            public void onDismiss(android.content.DialogInterface dialog) {
                if (!selectedFromPicker[0] && parentDialog != null && !parentDialog.isShowing()) {
                    parentDialog.show();
                    if (parentDialog.getWindow() != null) {
                        int screenWidth = getResources().getDisplayMetrics().widthPixels;
                        int screenHeight = getResources().getDisplayMetrics().heightPixels;
                        int dialogWidth = Math.max(dp(640), screenWidth - dp(8));
                        int dialogHeight = Math.max(dp(420), screenHeight - dp(16));
                        parentDialog.getWindow().setLayout(dialogWidth, dialogHeight);
                        parentDialog.getWindow().setGravity(Gravity.TOP | Gravity.CENTER_HORIZONTAL);
                        parentDialog.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
                    }
                }
            }
        });
    }

    private void showWarehouseDeleteEntryDialog(final WarehouseEntryItem item) {
        if (item == null || item.shelfEntryId <= 0) {
            toast("Entry non cancellabile");
            return;
        }

        AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle("Elimina prodotto")
            .setMessage("Rimuovere questo prodotto dalla posizione " + item.positionCode + "?")
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton("Elimina", new android.content.DialogInterface.OnClickListener() {
                @Override
                public void onClick(android.content.DialogInterface dialog, int which) {
                    runInBackground(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                httpRequest(API_URL + "/inventory/shelf-entries/" + item.shelfEntryId, "DELETE", null, token);
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        toast("Prodotto rimosso");
                                        loadInstantData();
                                    }
                                });
                            } catch (final Exception ex) {
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        toast("Errore eliminazione: " + ex.getMessage());
                                    }
                                });
                            }
                        }
                    });
                }
            })
            .create();
        dlg.show();
        styleDialogButtons(dlg);
    }

    private void showWarehouseAddProductDialog(final String posCode) {
        if (posCode == null || posCode.trim().isEmpty()) {
            toast("Posizione non valida");
            return;
        }

        final List<Article> articles = new ArrayList<Article>(articlesById.values());
        Collections.sort(articles, new Comparator<Article>() {
            @Override
            public int compare(Article a, Article b) {
                String an = a == null || a.name == null ? "" : a.name;
                String bn = b == null || b.name == null ? "" : b.name;
                return an.compareToIgnoreCase(bn);
            }
        });

        if (articles.isEmpty()) {
            toast("Nessun articolo disponibile");
            return;
        }

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(14), dp(10), dp(14), dp(6));
        layout.setBackgroundDrawable(roundedDrawable(0xFF0F172A, 0xFF1E293B, 1, 8));

        final List<String> labels = new ArrayList<String>();
        for (Article a : articles) {
            labels.add((a.name == null ? "Articolo" : a.name) + " (" + (a.code == null ? "-" : a.code) + ")");
        }

        final Spinner articleSpinner = new Spinner(this);
        ArrayAdapter<String> artAdapter = new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, labels);
        artAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        articleSpinner.setAdapter(artAdapter);
        styleDialogSpinner(articleSpinner);
        layout.addView(articleSpinner);

        final EditText qtyInput = new EditText(this);
        qtyInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        qtyInput.setHint("Quantita (colli)");
        qtyInput.setText("1");
        styleDialogField(qtyInput);
        LinearLayout.LayoutParams qtyLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        qtyLp.setMargins(0, dp(8), 0, 0);
        qtyInput.setLayoutParams(qtyLp);
        layout.addView(qtyInput);

        final EditText batchInput = new EditText(this);
        batchInput.setInputType(InputType.TYPE_CLASS_TEXT);
        batchInput.setHint("Lotto");
        styleDialogField(batchInput);
        LinearLayout.LayoutParams batchLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        batchLp.setMargins(0, dp(8), 0, 0);
        batchInput.setLayoutParams(batchLp);
        layout.addView(batchInput);

        final EditText expiryInput = new EditText(this);
        expiryInput.setInputType(InputType.TYPE_CLASS_TEXT);
        expiryInput.setHint("Scadenza");
        styleDialogField(expiryInput);
        LinearLayout.LayoutParams expiryLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        expiryLp.setMargins(0, dp(8), 0, 0);
        expiryInput.setLayoutParams(expiryLp);
        layout.addView(expiryInput);

        final AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle("Aggiungi prodotto in " + posCode)
            .setView(layout)
            .setPositiveButton("Aggiungi", null)
            .setNegativeButton(R.string.cancel, null)
            .create();

        dlg.show();
        styleDialogButtons(dlg);
        styleDialogWindowTop(dlg, 640, 420);
        Button ok = dlg.getButton(AlertDialog.BUTTON_POSITIVE);
        if (ok != null) {
            ok.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    int idx = articleSpinner.getSelectedItemPosition();
                    if (idx < 0 || idx >= articles.size()) {
                        toast("Seleziona articolo");
                        return;
                    }

                    int qty;
                    try {
                        qty = Integer.parseInt(qtyInput.getText().toString().trim());
                    } catch (Exception ex) {
                        qty = 0;
                    }
                    if (qty <= 0) {
                        toast("Quantita non valida");
                        return;
                    }

                    final Article selected = articles.get(idx);
                    if (selected == null || selected.id == null || selected.id.trim().isEmpty()) {
                        toast("Articolo non valido");
                        return;
                    }

                    final int qtyFinal = qty;
                    final String batch = batchInput.getText() == null ? "" : batchInput.getText().toString().trim();
                    final String expiry = expiryInput.getText() == null ? "" : expiryInput.getText().toString().trim();

                    runInBackground(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                JSONObject body = new JSONObject();
                                body.put("articleId", Integer.parseInt(selected.id));
                                body.put("positionCode", posCode);
                                body.put("quantity", qtyFinal);
                                body.put("batch", batch.isEmpty() ? JSONObject.NULL : batch);
                                body.put("expiry", expiry.isEmpty() ? JSONObject.NULL : expiry);
                                body.put("notes", JSONObject.NULL);
                                httpPostJson(API_URL + "/inventory/shelf-entries", body, token);
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        dlg.dismiss();
                                        toast("Prodotto aggiunto");
                                        loadInstantData();
                                    }
                                });
                            } catch (final Exception ex) {
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        toast("Errore aggiunta: " + ex.getMessage());
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }
    }

    private String getCategoryIcon(String categoryName) {
        if (categoryName != null) {
            String normalized = categoryName.trim().toUpperCase(Locale.ROOT);
            if (!normalized.isEmpty()) {
                String fromDb = categoryIconsByName.get(normalized);
                if (fromDb != null && !fromDb.trim().isEmpty()) {
                    return fromDb.trim();
                }

                if ("FARINE".equals(normalized)) return "🌾";
                if ("MIX FARINE".equals(normalized)) return "🥣";
                if ("SEMOLE".equals(normalized)) return "🌽";
                if ("CEREALI".equals(normalized)) return "🌿";
                if ("CEREALI PERLATI".equals(normalized)) return "💎";
                if ("MANGIMI".equals(normalized)) return "🐄";
                if ("ALTRO".equals(normalized)) return "📦";
            }
        }
        return "📦";
    }

    private String normalizeCategory(Article a) {
        String raw = a != null && a.category != null ? a.category.trim() : "";
        if (!raw.isEmpty()) return raw.toUpperCase(Locale.ROOT);

        String code = a != null && a.code != null ? a.code.toUpperCase(Locale.ROOT) : "";
        if (code.startsWith("F-")) return "FARINE";
        if (code.startsWith("FM-")) return "MIX FARINE";
        if (code.startsWith("GD-")) return "SEMOLE";
        if (code.startsWith("MG-")) return "MANGIMI";
        if (code.startsWith("CP-")) return "CEREALI PERLATI";
        if (code.startsWith("Z-")) return "CEREALI";
        return "ALTRO";
    }

    private String normalizeSubcategory(Article a) {
        String raw = a != null && a.subcategory != null ? a.subcategory.trim() : "";
        if (!raw.isEmpty()) return raw.toUpperCase(Locale.ROOT);
        return "NON CLASSIFICATA";
    }

    private String normalizeProductGroup(Article a) {
        String raw = a != null && a.productGroup != null ? a.productGroup.trim() : "";
        if (!raw.isEmpty()) return raw.toUpperCase(Locale.ROOT);
        return "";
    }

    private String normalizeGroupKey(String groupValue) {
        String raw = groupValue == null ? "" : groupValue.trim();
        if (raw.isEmpty()) return GROUP_NONE_KEY;
        return raw.toUpperCase(Locale.ROOT);
    }

    private String getGroupDisplayLabel(String groupKey) {
        if (groupKey == null || groupKey.trim().isEmpty() || GROUP_NONE_KEY.equals(groupKey)) {
            return getString(R.string.instant_group_none);
        }
        return groupKey;
    }

    private void refreshOrderLinesUi() {
        linesAdapter.clear();
        for (OrderLine line : orderLines) {
            String batch = line.batch == null || line.batch.isEmpty() ? "-" : line.batch;
            linesAdapter.add(line.articleName + "\n" + line.articleCode + " • Pos " + line.positionCode + " • " + line.quantity + " colli • L." + batch);
        }
        linesAdapter.notifyDataSetChanged();
    }

    private void showInstantAddDialog(final ProductRow row) {
        if (row == null || row.entries == null || row.entries.isEmpty()) {
            toast(R.string.no_entries_for_product);
            return;
        }

        final View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_instant_add, null);
        final TextView txtDialogProduct = (TextView) dialogView.findViewById(R.id.txtDialogProduct);
        final TextView txtDialogCode = (TextView) dialogView.findViewById(R.id.txtDialogCode);
        final TextView txtSelectedQty = (TextView) dialogView.findViewById(R.id.txtSelectedQty);
        final TextView txtAllocationList = (TextView) dialogView.findViewById(R.id.txtAllocationList);
        final Button btnQty1 = (Button) dialogView.findViewById(R.id.btnQty1);
        final Button btnQty2 = (Button) dialogView.findViewById(R.id.btnQty2);
        final Button btnQty5 = (Button) dialogView.findViewById(R.id.btnQty5);
        final Button btnQty10 = (Button) dialogView.findViewById(R.id.btnQty10);
        final ListView listDialogEntries = (ListView) dialogView.findViewById(R.id.listDialogEntries);

        txtDialogProduct.setText(row.name);
        txtDialogCode.setText(row.code);
        txtDialogProduct.setTextSize(30f);
        txtDialogCode.setTextSize(22f);
        txtSelectedQty.setTextSize(22f);
        txtAllocationList.setTextSize(20f);

        btnQty1.setTextSize(26f);
        btnQty2.setTextSize(26f);
        btnQty5.setTextSize(26f);
        btnQty10.setTextSize(26f);
        btnQty1.setTypeface(Typeface.DEFAULT_BOLD);
        btnQty2.setTypeface(Typeface.DEFAULT_BOLD);
        btnQty5.setTypeface(Typeface.DEFAULT_BOLD);
        btnQty10.setTypeface(Typeface.DEFAULT_BOLD);

        final int[] targetQty = new int[] { 0 };
        final LinkedHashMap<Long, Integer> allocations = new LinkedHashMap<Long, Integer>();
        final List<ShelfEntry> entries = new ArrayList<ShelfEntry>(row.entries);
        final List<String> labels = new ArrayList<String>();

        final Runnable updateDialogUi = new Runnable() {
            @Override
            public void run() {
                int selected = 0;
                for (Integer v : allocations.values()) selected += (v == null ? 0 : v.intValue());
                int remaining = Math.max(0, targetQty[0] - selected);
                txtSelectedQty.setText(getString(R.string.instant_target_totals, targetQty[0], selected, remaining));

                labels.clear();
                for (ShelfEntry en : entries) {
                    int selectedFromThis = allocations.containsKey(en.id) ? allocations.get(en.id) : 0;
                    int availableNow = Math.max(0, getAvailableForShelfEntry(en.id, -1) - selectedFromThis);
                    String batch = (en.batch == null || en.batch.isEmpty()) ? "-" : en.batch;
                    labels.add("Pos " + en.positionCode + " • Disp " + availableNow + " • Lotto " + batch + " • Sel " + selectedFromThis);
                }

                if (txtAllocationList != null) {
                    if (allocations.isEmpty()) {
                        txtAllocationList.setText(getString(R.string.instant_no_allocations));
                    } else {
                        StringBuilder sb = new StringBuilder();
                        for (Map.Entry<Long, Integer> e : allocations.entrySet()) {
                            ShelfEntry found = null;
                            for (ShelfEntry en : entries) {
                                if (en.id == e.getKey()) {
                                    found = en;
                                    break;
                                }
                            }
                            if (found == null) continue;
                            if (sb.length() > 0) sb.append("\n");
                            sb.append(getString(R.string.instant_selected_from_pos, found.positionCode, e.getValue()));
                        }
                        txtAllocationList.setText(sb.toString());
                    }
                }
            }
        };

        View.OnClickListener qtyListener = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (v == btnQty1) targetQty[0] += 1;
                if (v == btnQty2) targetQty[0] += 2;
                if (v == btnQty5) targetQty[0] += 5;
                if (v == btnQty10) targetQty[0] += 10;
                updateDialogUi.run();
            }
        };
        btnQty1.setOnClickListener(qtyListener);
        btnQty2.setOnClickListener(qtyListener);
        btnQty5.setOnClickListener(qtyListener);
        btnQty10.setOnClickListener(qtyListener);

        ArrayAdapter<String> adapter = new ArrayAdapter<String>(this, R.layout.row_operatorlite_list_item_large, R.id.rowText, labels);
        listDialogEntries.setAdapter(adapter);
        listDialogEntries.setDividerHeight(dp(2));

        final AlertDialog dlg = new AlertDialog.Builder(this)
            .setView(dialogView)
            .setPositiveButton(R.string.add, null)
            .setNegativeButton(R.string.cancel, null)
            .create();

        listDialogEntries.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                if (position < 0 || position >= entries.size()) return;
                ShelfEntry entry = entries.get(position);

                if (allocations.containsKey(entry.id)) {
                    allocations.remove(entry.id);
                    updateDialogUi.run();
                    adapter.notifyDataSetChanged();
                    return;
                }

                if (targetQty[0] <= 0) {
                    toast(R.string.instant_need_target);
                    return;
                }

                int selected = 0;
                for (Integer v : allocations.values()) selected += (v == null ? 0 : v.intValue());
                int remaining = Math.max(0, targetQty[0] - selected);
                if (remaining <= 0) {
                    toast(getString(R.string.instant_need_complete_pick, 0));
                    return;
                }

                int available = getAvailableForShelfEntry(entry.id, -1);
                int allocQty = Math.min(remaining, available);
                if (allocQty <= 0) {
                    toast(getString(R.string.qty_exceeds, 0));
                    return;
                }

                allocations.put(entry.id, allocQty);
                updateDialogUi.run();
                adapter.notifyDataSetChanged();
            }
        });

        dlg.show();
        styleDialogButtons(dlg);
        styleDialogWindowTop(dlg, 700, 460);

        if (entries.size() == 1) {
            ShelfEntry only = entries.get(0);
            int available = getAvailableForShelfEntry(only.id, -1);
            if (available > 0) {
                targetQty[0] = 1;
                allocations.put(only.id, 1);
            }
        }

        updateDialogUi.run();
        adapter.notifyDataSetChanged();

        Button confirmBtn = dlg.getButton(AlertDialog.BUTTON_POSITIVE);
        if (confirmBtn != null) {
            confirmBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    int selected = 0;
                    for (Integer q : allocations.values()) selected += (q == null ? 0 : q.intValue());
                    if (targetQty[0] <= 0) {
                        toast(R.string.instant_need_target);
                        return;
                    }
                    if (selected <= 0) {
                        toast(R.string.instant_need_positions);
                        return;
                    }
                    if (selected != targetQty[0]) {
                        toast(getString(R.string.instant_need_complete_pick, Math.max(0, targetQty[0] - selected)));
                        return;
                    }

                    for (Map.Entry<Long, Integer> e : allocations.entrySet()) {
                        ShelfEntry found = null;
                        for (ShelfEntry en : entries) {
                            if (en.id == e.getKey()) {
                                found = en;
                                break;
                            }
                        }
                        if (found == null || e.getValue() == null || e.getValue() <= 0) continue;

                        OrderLine line = new OrderLine();
                        line.articleId = row.articleId;
                        line.articleCode = row.code;
                        line.articleName = row.name;
                        line.positionCode = found.positionCode;
                        line.shelfEntryId = found.id;
                        line.batch = found.batch;
                        line.quantity = e.getValue();
                        orderLines.add(line);
                    }
                    refreshOrderLinesUi();
                    dlg.dismiss();
                }
            });
        }
    }

    private void showEntrySelectionDialog(final ProductRow row) {
        if (row.entries == null || row.entries.isEmpty()) {
            toast(R.string.no_entries_for_product);
            return;
        }

        final String[] items = new String[row.entries.size()];
        for (int i = 0; i < row.entries.size(); i++) {
            ShelfEntry en = row.entries.get(i);
            String batch = (en.batch == null || en.batch.isEmpty()) ? "-" : en.batch;
            items[i] = "Pos " + en.positionCode + " • Disp " + en.quantity + " • Lotto " + batch;
        }

        AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle(row.name)
            .setItems(items, new android.content.DialogInterface.OnClickListener() {
                @Override
                public void onClick(android.content.DialogInterface dialog, int which) {
                    if (which < 0 || which >= row.entries.size()) return;
                    showQuantityDialog(row, row.entries.get(which));
                }
            })
            .setNegativeButton(R.string.cancel, null)
            .create();
        dlg.show();
        styleDialogButtons(dlg);
    }

    private void showQuantityDialog(final ProductRow row, final ShelfEntry entry) {
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_NUMBER);
        input.setText("1");
        input.setSelection(input.getText().length());

        AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle(getString(R.string.dialog_qty_title, row.name, entry.positionCode))
            .setView(input)
            .setPositiveButton(R.string.add, new android.content.DialogInterface.OnClickListener() {
                @Override
                public void onClick(android.content.DialogInterface dialog, int which) {
                    int qty;
                    try {
                        qty = Integer.parseInt(input.getText().toString().trim());
                    } catch (Exception ex) {
                        qty = 0;
                    }
                    if (qty <= 0) {
                        toast(R.string.qty_invalid);
                        return;
                    }
                    int maxAllowed = getAvailableForShelfEntry(entry.id, -1);
                    if (qty > maxAllowed) {
                        toast(getString(R.string.qty_exceeds, maxAllowed));
                        return;
                    }

                    OrderLine line = new OrderLine();
                    line.articleId = row.articleId;
                    line.articleCode = row.code;
                    line.articleName = row.name;
                    line.positionCode = entry.positionCode;
                    line.shelfEntryId = entry.id;
                    line.batch = entry.batch;
                    line.quantity = qty;
                    orderLines.add(line);
                    refreshOrderLinesUi();
                }
            })
            .setNegativeButton(R.string.cancel, null)
            .create();
        dlg.show();
        styleDialogButtons(dlg);
        styleDialogField(input);
        styleDialogWindowTop(dlg, 520, 300);
    }

    private void loadAndShowTasksDialog() {
        if (token == null || token.trim().isEmpty()) {
            toast(R.string.login_required);
            return;
        }

        setStatus(getString(R.string.status_loading_tasks));
        runInBackground(new Runnable() {
            @Override
            public void run() {
                try {
                    final JSONArray tasksArr = httpGetArray(API_URL + "/tasks", token);
                    String incomingFingerprint = buildJsonFingerprint(tasksArr);
                    if (!forceTasksRefresh && incomingFingerprint.equals(lastTasksFingerprint)) {
                        return;
                    }
                    final List<TaskItem> taskItems = parseTasks(tasksArr);
                    final String newFingerprint = incomingFingerprint;

                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            visibleTaskItems.clear();
                            visibleTaskItems.addAll(taskItems);
                            lastTasksFingerprint = newFingerprint;
                            forceTasksRefresh = false;
                            refreshProductsUi();
                            if (taskItems.isEmpty()) {
                                toast(R.string.tasks_empty);
                            }
                        }
                    });
                } catch (final Exception ex) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            visibleTaskItems.clear();
                            if ("tasks".equals(activeModule)) refreshProductsUi();
                            setStatus(getString(R.string.status_error, ex.getMessage()));
                            toast(getString(R.string.tasks_error, ex.getMessage()));
                        }
                    });
                }
            }
        });
    }

    private List<TaskItem> parseTasks(JSONArray arr) {
        List<TaskItem> out = new ArrayList<TaskItem>();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject obj = arr.optJSONObject(i);
            if (obj == null) continue;

            long assignedOperatorId = obj.optLong("assignedOperatorId", -1);
            JSONObject assignedOperator = obj.optJSONObject("assignedOperator");
            if (assignedOperatorId <= 0 && assignedOperator != null) {
                assignedOperatorId = assignedOperator.optLong("id", -1);
            }

            if (currentUserId > 0 && assignedOperatorId != currentUserId) {
                continue;
            }

            TaskItem t = new TaskItem();
            t.id = obj.optInt("id", -1);
            t.title = obj.optString("title", "Task");
            t.completed = obj.optBoolean("completed", false);
            t.paused = obj.optBoolean("paused", false);
            t.acceptedAt = obj.optString("acceptedAt", "");
            t.assignedOperatorId = assignedOperatorId;

            if (t.id <= 0) continue;

            if (t.completed) {
                t.stateLabel = "[COMPLETATO]";
            } else if (t.paused) {
                t.stateLabel = "[PAUSA]";
            } else if (t.acceptedAt != null && !t.acceptedAt.trim().isEmpty() && !"null".equalsIgnoreCase(t.acceptedAt)) {
                t.stateLabel = "[IN CORSO]";
            } else {
                t.stateLabel = "[NUOVO]";
            }

            out.add(t);
        }

        Collections.sort(out, new Comparator<TaskItem>() {
            @Override
            public int compare(TaskItem a, TaskItem b) {
                boolean aDone = a != null && a.completed;
                boolean bDone = b != null && b.completed;
                if (aDone != bDone) return aDone ? 1 : -1;
                int aid = a == null ? 0 : a.id;
                int bid = b == null ? 0 : b.id;
                return Integer.compare(bid, aid);
            }
        });

        return out;
    }

    private void showTaskBoardDialog(final List<TaskItem> taskItems) {
        if (taskItems == null || taskItems.isEmpty()) {
            toast(R.string.tasks_empty);
            return;
        }

        ScrollView rootScroll = new ScrollView(this);
        rootScroll.setFillViewport(true);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(12), dp(10), dp(12), dp(10));
        rootScroll.addView(layout, new ScrollView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        TextView helper = new TextView(this);
        helper.setText("Board task operatore");
        helper.setTextColor(0xFFCBD5E1);
        helper.setTextSize(18f);
        helper.setTypeface(Typeface.DEFAULT_BOLD);
        helper.setPadding(0, 0, 0, dp(8));
        layout.addView(helper);

        final AlertDialog[] hostDialog = new AlertDialog[1];

        for (TaskItem task : taskItems) {
            View card = buildTaskBoardCard(task, hostDialog);
            LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            cardLp.setMargins(0, 0, 0, dp(10));
            card.setLayoutParams(cardLp);
            layout.addView(card);
        }

        hostDialog[0] = new AlertDialog.Builder(this)
            .setTitle(R.string.tasks_title)
            .setView(rootScroll)
            .setNegativeButton(R.string.cancel, null)
            .create();

        hostDialog[0].show();
        styleDialogButtons(hostDialog[0]);
        styleDialogWindowTop(hostDialog[0], 700, 460);
    }

    private View buildTaskBoardCard(final TaskItem task, final AlertDialog[] hostDialog) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(12), dp(10), dp(12), dp(10));

        boolean accepted = task != null && task.acceptedAt != null && !task.acceptedAt.trim().isEmpty() && !"null".equalsIgnoreCase(task.acceptedAt.trim());
        int borderColor = 0xFF8B5CF6;
        int statusBg = 0xFF8B5CF6;
        String statusText = "IN ATTESA";

        if (task != null && task.completed) {
            borderColor = 0xFF22C55E;
            statusBg = 0xFF22C55E;
            statusText = "COMPLETATO";
        } else if (task != null && task.paused) {
            borderColor = 0xFFF59E0B;
            statusBg = 0xFFF59E0B;
            statusText = "IN PAUSA";
        } else if (accepted) {
            borderColor = 0xFF3B82F6;
            statusBg = 0xFF3B82F6;
            statusText = "IN CORSO";
        }

        card.setBackgroundDrawable(roundedDrawable(0xFF2D2D2D, borderColor, 2, 8));

        TextView title = new TextView(this);
        title.setText(task == null || task.title == null ? "Task" : task.title);
        title.setTextColor(0xFFFFFFFF);
        title.setTextSize(22f);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(title);

        TextView meta = new TextView(this);
        meta.setText("#" + (task == null ? 0 : task.id));
        meta.setTextColor(0xFF94A3B8);
        meta.setTextSize(16f);
        meta.setPadding(0, dp(3), 0, dp(8));
        card.addView(meta);

        TextView status = new TextView(this);
        status.setText(statusText);
        status.setTextColor(0xFFFFFFFF);
        status.setTextSize(15f);
        status.setTypeface(Typeface.DEFAULT_BOLD);
        status.setPadding(dp(10), dp(6), dp(10), dp(6));
        status.setBackgroundDrawable(roundedDrawable(statusBg, 0x00000000, 0, 6));
        card.addView(status);

        if (task != null && task.acceptedAt != null && !task.acceptedAt.trim().isEmpty() && !"null".equalsIgnoreCase(task.acceptedAt.trim())) {
            TextView timeline = new TextView(this);
            timeline.setText("👍 Accettato: " + task.acceptedAt);
            timeline.setTextColor(0xFFA0AEC0);
            timeline.setTextSize(14f);
            timeline.setPadding(0, dp(8), 0, dp(4));
            card.addView(timeline);
        }

        if (task != null && !task.completed) {
            LinearLayout actions = new LinearLayout(this);
            actions.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams actionsLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            actionsLp.setMargins(0, dp(10), 0, 0);
            actions.setLayoutParams(actionsLp);

            if (!accepted) {
                Button acceptBtn = new Button(this);
                acceptBtn.setAllCaps(false);
                acceptBtn.setText("👍 Accetta");
                acceptBtn.setTextColor(0xFFFFFFFF);
                acceptBtn.setTextSize(17f);
                acceptBtn.setTypeface(Typeface.DEFAULT_BOLD);
                acceptBtn.setBackgroundDrawable(roundedDrawable(0xFF22C55E, 0x00000000, 0, 6));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(46), 1f);
                acceptBtn.setLayoutParams(lp);
                acceptBtn.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        executeTaskAction("/tasks/" + task.id + "/accept", new Runnable() {
                            @Override
                            public void run() {
                                if (hostDialog != null && hostDialog[0] != null) hostDialog[0].dismiss();
                                loadAndShowTasksDialog();
                            }
                        });
                    }
                });
                actions.addView(acceptBtn);
            } else if (task.paused) {
                Button resumeBtn = new Button(this);
                resumeBtn.setAllCaps(false);
                resumeBtn.setText("▶️ Riprendi");
                resumeBtn.setTextColor(0xFFFFFFFF);
                resumeBtn.setTextSize(17f);
                resumeBtn.setTypeface(Typeface.DEFAULT_BOLD);
                resumeBtn.setBackgroundDrawable(roundedDrawable(0xFF8B5CF6, 0x00000000, 0, 6));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(46), 1f);
                resumeBtn.setLayoutParams(lp);
                resumeBtn.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        executeTaskAction("/tasks/" + task.id + "/resume", new Runnable() {
                            @Override
                            public void run() {
                                if (hostDialog != null && hostDialog[0] != null) hostDialog[0].dismiss();
                                loadAndShowTasksDialog();
                            }
                        });
                    }
                });
                actions.addView(resumeBtn);
            } else {
                Button completeBtn = new Button(this);
                completeBtn.setAllCaps(false);
                completeBtn.setText("✅ Completa");
                completeBtn.setTextColor(0xFFFFFFFF);
                completeBtn.setTextSize(17f);
                completeBtn.setTypeface(Typeface.DEFAULT_BOLD);
                completeBtn.setBackgroundDrawable(roundedDrawable(0xFF3B82F6, 0x00000000, 0, 6));
                LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(0, dp(46), 1f);
                cLp.setMargins(0, 0, dp(6), 0);
                completeBtn.setLayoutParams(cLp);
                completeBtn.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        executeTaskAction("/tasks/" + task.id + "/complete", new Runnable() {
                            @Override
                            public void run() {
                                if (hostDialog != null && hostDialog[0] != null) hostDialog[0].dismiss();
                                loadAndShowTasksDialog();
                            }
                        });
                    }
                });
                actions.addView(completeBtn);

                Button pauseBtn = new Button(this);
                pauseBtn.setAllCaps(false);
                pauseBtn.setText("⏸️ Pausa");
                pauseBtn.setTextColor(0xFFFFFFFF);
                pauseBtn.setTextSize(17f);
                pauseBtn.setTypeface(Typeface.DEFAULT_BOLD);
                pauseBtn.setBackgroundDrawable(roundedDrawable(0xFFF59E0B, 0x00000000, 0, 6));
                LinearLayout.LayoutParams pLp = new LinearLayout.LayoutParams(0, dp(46), 1f);
                pauseBtn.setLayoutParams(pLp);
                pauseBtn.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        executeTaskAction("/tasks/" + task.id + "/pause", new Runnable() {
                            @Override
                            public void run() {
                                if (hostDialog != null && hostDialog[0] != null) hostDialog[0].dismiss();
                                loadAndShowTasksDialog();
                            }
                        });
                    }
                });
                actions.addView(pauseBtn);
            }

            card.addView(actions);
        }

        return card;
    }

    private void showTaskActionsDialog(final TaskItem task) {
        if (task.completed) {
            toast(R.string.task_done);
            return;
        }

        final List<String> labels = new ArrayList<String>();
        final List<String> endpoints = new ArrayList<String>();

        if (task.acceptedAt == null || task.acceptedAt.trim().isEmpty() || "null".equalsIgnoreCase(task.acceptedAt)) {
            labels.add(getString(R.string.task_accept));
            endpoints.add("/tasks/" + task.id + "/accept");
        }
        if (task.paused) {
            labels.add(getString(R.string.task_resume));
            endpoints.add("/tasks/" + task.id + "/resume");
        } else {
            labels.add(getString(R.string.task_pause));
            endpoints.add("/tasks/" + task.id + "/pause");
        }
        labels.add(getString(R.string.task_complete));
        endpoints.add("/tasks/" + task.id + "/complete");

        final String[] actions = labels.toArray(new String[0]);

        AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle(getString(R.string.task_action_title, task.id))
            .setItems(actions, new android.content.DialogInterface.OnClickListener() {
                @Override
                public void onClick(android.content.DialogInterface dialog, int which) {
                    if (which < 0 || which >= endpoints.size()) return;
                    executeTaskAction(endpoints.get(which));
                }
            })
            .setNegativeButton(R.string.cancel, null)
            .create();
        dlg.show();
        styleDialogButtons(dlg);
        styleDialogWindowTop(dlg, 620, 360);
    }

    private void executeTaskAction(final String endpoint) {
        executeTaskAction(endpoint, null);
    }

    private void executeTaskAction(final String endpoint, final Runnable onSuccess) {
        if (token == null || token.trim().isEmpty()) {
            toast(R.string.login_required);
            return;
        }

        runInBackground(new Runnable() {
            @Override
            public void run() {
                try {
                    httpPostJson(API_URL + endpoint, new JSONObject(), token);
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            toast(R.string.task_updated);
                            forceTasksRefresh = true;
                            if (onSuccess != null) {
                                onSuccess.run();
                            } else {
                                loadAndShowTasksDialog();
                            }
                        }
                    });
                } catch (final Exception ex) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            toast(getString(R.string.tasks_error, ex.getMessage()));
                        }
                    });
                }
            }
        });
    }

    private void showWarehouseDialog() {
        renderWarehouseSection();
    }

    private void renderWarehouseSection() {
        if (warehouseSection == null || warehousePositionsContainer == null) return;
        warehouseSection.setVisibility(View.VISIBLE);
        updateModuleButtons();

        if (txtProductsTitle != null) txtProductsTitle.setText("");
        if (txtInstantStepHint != null) txtInstantStepHint.setText("");

        if (warehouseSectorRow != null) warehouseSectorRow.setVisibility(View.GONE);
        if (warehouseProductsPanel != null) warehouseProductsPanel.setVisibility("products".equals(warehouseViewMode) ? View.VISIBLE : View.GONE);
        if (warehouseShelvesPanel != null) warehouseShelvesPanel.setVisibility("shelves".equals(warehouseViewMode) ? View.VISIBLE : View.GONE);

        Map<String, List<WarehouseEntryItem>> byPosition = new HashMap<String, List<WarehouseEntryItem>>();
        Map<String, String> positionDescriptionByCode = new HashMap<String, String>();
        Map<String, Boolean> positionBlockedByCode = new HashMap<String, Boolean>();
        Map<String, Integer> remainingReservedByShelfKey = new HashMap<String, Integer>();

        for (ShelfPositionInfo sp : shelfPositions) {
            if (sp == null || sp.code == null || sp.code.trim().isEmpty()) continue;
            String code = sp.code.trim();
            positionBlockedByCode.put(code, !sp.isActive);
            String cleanDescription = normalizeOptionalText(sp.description);
            if (!cleanDescription.isEmpty()) {
                positionDescriptionByCode.put(code, cleanDescription);
            }
            if (sp.isActive && !byPosition.containsKey(code)) {
                byPosition.put(code, new ArrayList<WarehouseEntryItem>());
            }
        }

        for (ProductRow row : productRows) {
            if (row.entries == null) continue;
            for (ShelfEntry en : row.entries) {
                String pos = en.positionCode == null ? "-" : en.positionCode;
                if (Boolean.TRUE.equals(positionBlockedByCode.get(pos))) {
                    continue;
                }
                if (!byPosition.containsKey(pos)) {
                    byPosition.put(pos, new ArrayList<WarehouseEntryItem>());
                }
                String reservationKey = buildReservationKey(row.code, en.batch, pos);
                if (!remainingReservedByShelfKey.containsKey(reservationKey)) {
                    double reservedKg = reservationsKgByPosition.containsKey(reservationKey) ? reservationsKgByPosition.get(reservationKey) : 0d;
                    remainingReservedByShelfKey.put(reservationKey, toReservedColli(reservedKg, row.weightPerCollo));
                }
                WarehouseEntryItem item = new WarehouseEntryItem();
                item.positionCode = pos;
                item.shelfEntryId = en.id;
                item.articleId = row.articleId;
                item.articleName = row.name;
                item.articleCode = row.code;
                item.quantity = en.quantity;
                int reservedLeft = remainingReservedByShelfKey.containsKey(reservationKey) ? remainingReservedByShelfKey.get(reservationKey) : 0;
                item.reservedQuantity = Math.min(Math.max(0, en.quantity), Math.max(0, reservedLeft));
                item.availableQuantity = Math.max(0, en.quantity - item.reservedQuantity);
                remainingReservedByShelfKey.put(reservationKey, Math.max(0, reservedLeft - item.reservedQuantity));
                item.batch = en.batch;
                item.expiry = en.expiry;
                byPosition.get(pos).add(item);
            }
        }

        renderWarehouseProductsView();

        if (!"shelves".equals(warehouseViewMode)) {
            return;
        }

        Map<String, List<String>> sectorPositions = new HashMap<String, List<String>>();
        for (String posCode : byPosition.keySet()) {
            if (posCode == null || posCode.trim().isEmpty()) continue;
            String sector = posCode.substring(0, 1).toUpperCase(Locale.ROOT);
            List<String> list = sectorPositions.get(sector);
            if (list == null) {
                list = new ArrayList<String>();
                sectorPositions.put(sector, list);
            }
            list.add(posCode);
        }

        warehousePositionsContainer.removeAllViews();
        if (sectorPositions.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText("Nessuna posizione scaffale disponibile");
            empty.setTextColor(0xFFD1D5DB);
            empty.setTextSize(18f);
            empty.setPadding(dp(10), dp(10), dp(10), dp(10));
            warehousePositionsContainer.addView(empty);
            return;
        }

        List<String> sectors = new ArrayList<String>(sectorPositions.keySet());
        Collections.sort(sectors);

        for (final String sector : sectors) {
            List<String> positions = sectorPositions.get(sector);
            if (positions == null) continue;
            Collections.sort(positions);

            int occupied = 0;
            for (String pos : positions) {
                List<WarehouseEntryItem> items = byPosition.get(pos);
                if (items != null && !items.isEmpty()) occupied++;
            }

            Button sectorButton = new Button(this);
            sectorButton.setAllCaps(false);
            sectorButton.setTextColor(0xFFFFFFFF);
            sectorButton.setTextSize(18f);
            sectorButton.setBackgroundResource(sector.equals(expandedWarehouseSector) ? R.drawable.bg_toolbar_button_orange : R.drawable.bg_toolbar_button_dark);
            sectorButton.setMinHeight(dp(72));
            sectorButton.setMinimumHeight(dp(72));
            sectorButton.setPadding(dp(14), dp(10), dp(14), dp(10));
            String chevron = sector.equals(expandedWarehouseSector) ? "▼" : "▶";
            sectorButton.setText("Settore " + sector + " " + chevron + "\n" + occupied + "/" + positions.size() + " occupate");
            LinearLayout.LayoutParams sectorLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            sectorLp.setMargins(0, 0, 0, dp(8));
            sectorButton.setLayoutParams(sectorLp);
            sectorButton.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    if (sector.equals(expandedWarehouseSector)) {
                        expandedWarehouseSector = null;
                    } else {
                        expandedWarehouseSector = sector;
                    }
                    renderWarehouseSection();
                }
            });

            warehousePositionsContainer.addView(sectorButton);

            if (!sector.equals(expandedWarehouseSector)) {
                continue;
            }

            LinearLayout positionsHolder = new LinearLayout(this);
            positionsHolder.setOrientation(LinearLayout.VERTICAL);
            LinearLayout.LayoutParams holderLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            holderLp.setMargins(0, 0, 0, dp(10));
            positionsHolder.setLayoutParams(holderLp);

            List<View> cards = new ArrayList<View>();
            for (final String pos : positions) {
                List<WarehouseEntryItem> items = byPosition.get(pos);
                cards.add(buildWarehousePositionCard(pos, positionDescriptionByCode.get(pos), items));
            }
            addViewsInThreeColumns(positionsHolder, cards);
            warehousePositionsContainer.addView(positionsHolder);
        }
    }

    private void renderWarehouseProductsView() {
        if (warehouseCategoryRow == null || warehouseSubcategoryRow == null || warehouseProductsAdapter == null) return;

        warehouseCategoryRow.removeAllViews();
        warehouseSubcategoryRow.removeAllViews();
        visibleWarehouseRows.clear();
        warehouseProductsAdapter.clear();

        List<String> categories = new ArrayList<String>();
        for (ProductRow row : productRows) {
            if (row == null || row.category == null || row.category.trim().isEmpty()) continue;
            if (!categories.contains(row.category)) categories.add(row.category);
        }
        Collections.sort(categories);

        if (WAREHOUSE_STEP_CATEGORY.equals(warehouseProductsStep)) {
            if (txtProductsTitle != null) txtProductsTitle.setText("Magazzino - Categorie");
            if (txtInstantStepHint != null) txtInstantStepHint.setText("Seleziona una categoria");

            warehouseCategoryRow.setVisibility(View.VISIBLE);
            warehouseSubcategoryRow.setVisibility(View.GONE);
            warehouseProductsList.setVisibility(View.GONE);

            List<Button> catButtons = new ArrayList<Button>();
            for (final String cat : categories) {
                String label = getCategoryIcon(cat) + " " + cat;
                Button b = buildWarehouseFilterButton(label, false);
                b.setTextSize(18f);
                b.setMinHeight(dp(64));
                b.setMinimumHeight(dp(64));
                b.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        warehouseCategory = cat;
                        warehouseSubcategory = null;
                        warehouseGroup = null;
                        warehouseSelectedGroupArticleIds.clear();

                        List<String> subcategories = getWarehouseSubcategories(cat);
                        if (subcategories.isEmpty()) {
                            warehouseProductsStep = WAREHOUSE_STEP_PRODUCTS;
                        } else {
                            warehouseProductsStep = WAREHOUSE_STEP_SUBCATEGORY;
                        }
                        renderWarehouseProductsView();
                    }
                });
                catButtons.add(b);
            }
            addButtonsInTwoColumns(warehouseCategoryRow, catButtons);
            return;
        }

        if (WAREHOUSE_STEP_SUBCATEGORY.equals(warehouseProductsStep)) {
            if (txtProductsTitle != null) txtProductsTitle.setText("Magazzino - " + (warehouseCategory == null ? "Sottocategorie" : warehouseCategory));
            if (txtInstantStepHint != null) txtInstantStepHint.setText("Seleziona una sottocategoria");

            warehouseCategoryRow.setVisibility(View.GONE);
            warehouseSubcategoryRow.setVisibility(View.VISIBLE);
            warehouseProductsList.setVisibility(View.GONE);

            List<Button> subButtons = new ArrayList<Button>();
            Button backToCategories = buildWarehouseFilterButton("◀ Categorie", false);
            backToCategories.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    warehouseProductsStep = WAREHOUSE_STEP_CATEGORY;
                    warehouseCategory = null;
                    warehouseSubcategory = null;
                    warehouseGroup = null;
                    warehouseSelectedGroupArticleIds.clear();
                    renderWarehouseProductsView();
                }
            });
            subButtons.add(backToCategories);

            final List<String> subcategories = getWarehouseSubcategories(warehouseCategory);
            for (final String sub : subcategories) {
                Button sb = buildWarehouseFilterButton(getCategoryIcon(warehouseCategory) + " " + sub, false);
                sb.setTextSize(17f);
                sb.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        warehouseSubcategory = sub;
                        warehouseGroup = null;
                        warehouseSelectedGroupArticleIds.clear();
                        List<String> groups = getWarehouseGroups(warehouseCategory, warehouseSubcategory);
                        if (groups.isEmpty()) {
                            warehouseProductsStep = WAREHOUSE_STEP_PRODUCTS;
                        } else {
                            warehouseProductsStep = WAREHOUSE_STEP_GROUP;
                        }
                        renderWarehouseProductsView();
                    }
                });
                subButtons.add(sb);
            }
            addButtonsInTwoColumns(warehouseSubcategoryRow, subButtons);
            return;
        }

        if (WAREHOUSE_STEP_GROUP.equals(warehouseProductsStep)) {
            if (txtProductsTitle != null) txtProductsTitle.setText("Magazzino - " + (warehouseCategory == null ? "Gruppi" : warehouseCategory + " / " + warehouseSubcategory));
            if (txtInstantStepHint != null) txtInstantStepHint.setText("Seleziona un gruppo");

            warehouseCategoryRow.setVisibility(View.GONE);
            warehouseSubcategoryRow.setVisibility(View.VISIBLE);
            warehouseProductsList.setVisibility(View.GONE);

            List<Button> groupButtons = new ArrayList<Button>();
            Button backToSubcategories = buildWarehouseFilterButton("◀ Sottocategorie", false);
            backToSubcategories.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    warehouseProductsStep = WAREHOUSE_STEP_SUBCATEGORY;
                    warehouseGroup = null;
                    warehouseSelectedGroupArticleIds.clear();
                    renderWarehouseProductsView();
                }
            });
            groupButtons.add(backToSubcategories);

            final List<String> groups = getWarehouseGroups(warehouseCategory, warehouseSubcategory);
            for (final String groupKey : groups) {
                String label = GROUP_NONE_KEY.equals(groupKey) ? "Senza gruppo" : groupKey;
                Button gb = buildWarehouseFilterButton(label, false);
                gb.setTextSize(17f);
                gb.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        warehouseGroup = groupKey;
                        final List<ProductRow> matchedRows = new ArrayList<ProductRow>();
                        for (ProductRow row : productRows) {
                            if (!matchesWarehouseCategory(row, warehouseCategory)) continue;
                            if (!matchesWarehouseSubcategory(row, warehouseSubcategory)) continue;
                            if (!matchesWarehouseGroup(row, warehouseGroup)) continue;
                            matchedRows.add(row);
                        }
                        refreshWarehouseSelectedGroupArticleIds();
                        if (!matchedRows.isEmpty()) {
                            String groupLabel = GROUP_NONE_KEY.equals(groupKey) ? "Senza gruppo" : groupKey;
                            showWarehouseGroupProductsDialog(groupLabel, matchedRows);
                        } else {
                            toast("Nessun prodotto per il gruppo selezionato");
                        }
                    }
                });
                groupButtons.add(gb);
            }
            addButtonsInTwoColumns(warehouseSubcategoryRow, groupButtons);
            return;
        }

        if (txtProductsTitle != null) txtProductsTitle.setText("Magazzino - Prodotti");
        if (txtInstantStepHint != null) txtInstantStepHint.setText("Tocca un prodotto per vedere le posizioni");

        warehouseCategoryRow.setVisibility(View.GONE);
        warehouseSubcategoryRow.setVisibility(View.VISIBLE);
        warehouseProductsList.setVisibility(View.GONE);

        List<Button> navButtons = new ArrayList<Button>();
        Button backCategories = buildWarehouseFilterButton("◀ Categorie", false);
        backCategories.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                warehouseProductsStep = WAREHOUSE_STEP_CATEGORY;
                warehouseCategory = null;
                warehouseSubcategory = null;
                warehouseGroup = null;
                warehouseSelectedGroupArticleIds.clear();
                renderWarehouseProductsView();
            }
        });
        navButtons.add(backCategories);

        List<String> currentSubs = getWarehouseSubcategories(warehouseCategory);
        if (!currentSubs.isEmpty()) {
            Button backSubs = buildWarehouseFilterButton("◀ Sottocategorie", false);
            backSubs.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    warehouseProductsStep = WAREHOUSE_STEP_SUBCATEGORY;
                    warehouseSubcategory = null;
                    warehouseGroup = null;
                    warehouseSelectedGroupArticleIds.clear();
                    renderWarehouseProductsView();
                }
            });
            navButtons.add(backSubs);
        }

        List<String> currentGroups = getWarehouseGroups(warehouseCategory, warehouseSubcategory);
        if (!currentGroups.isEmpty()) {
            Button backGroups = buildWarehouseFilterButton("◀ Gruppi", false);
            backGroups.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    warehouseProductsStep = WAREHOUSE_STEP_GROUP;
                    warehouseGroup = null;
                    warehouseSelectedGroupArticleIds.clear();
                    renderWarehouseProductsView();
                }
            });
            navButtons.add(backGroups);
        }
        addButtonsInTwoColumns(warehouseSubcategoryRow, navButtons);

        List<ProductRow> categorySubcategoryRows = new ArrayList<ProductRow>();
        for (ProductRow row : productRows) {
            if (!matchesWarehouseCategory(row, warehouseCategory)) continue;
            if (!matchesWarehouseSubcategory(row, warehouseSubcategory)) continue;
            categorySubcategoryRows.add(row);
        }

        if (categorySubcategoryRows.isEmpty() && warehouseGroup != null) {
            for (ProductRow row : productRows) {
                if (!matchesWarehouseGroup(row, warehouseGroup)) continue;
                categorySubcategoryRows.add(row);
            }
            if (!categorySubcategoryRows.isEmpty() && txtInstantStepHint != null) {
                txtInstantStepHint.setText("Filtro categoria/sottocategoria vuoto: mostrati prodotti del gruppo selezionato (fallback globale).");
            }
        }

        if (categorySubcategoryRows.isEmpty() && warehouseGroup != null && !productRows.isEmpty()) {
            categorySubcategoryRows.addAll(productRows);
            if (txtInstantStepHint != null) {
                txtInstantStepHint.setText("Filtro non coerente: mostrati tutti i prodotti disponibili.");
            }
        }

        boolean usePinnedGroupArticleIds = warehouseGroup != null && !warehouseSelectedGroupArticleIds.isEmpty();
        for (ProductRow row : categorySubcategoryRows) {
            if (usePinnedGroupArticleIds) {
                if (row == null || row.articleId == null || !warehouseSelectedGroupArticleIds.contains(row.articleId)) continue;
            } else {
                if (!matchesWarehouseGroup(row, warehouseGroup)) continue;
            }
            appendWarehouseProductRow(row);
        }

        if (visibleWarehouseRows.isEmpty() && warehouseGroup != null) {
            for (ProductRow row : categorySubcategoryRows) {
                if (!matchesWarehouseGroup(row, warehouseGroup)) continue;
                appendWarehouseProductRow(row);
            }
        }

        if (visibleWarehouseRows.isEmpty() && warehouseGroup != null && !categorySubcategoryRows.isEmpty()) {
            for (ProductRow row : categorySubcategoryRows) {
                appendWarehouseProductRow(row);
            }
            if (txtInstantStepHint != null) {
                String groupLabel = GROUP_NONE_KEY.equals(warehouseGroup) ? "Senza gruppo" : warehouseGroup;
                txtInstantStepHint.setText("Nessuna corrispondenza gruppo '" + groupLabel + "'. Mostrati tutti i prodotti della sottocategoria.");
            }
        }

        List<Button> productButtons = new ArrayList<Button>();
        for (final ProductRow row : visibleWarehouseRows) {
            String taxonomy = row.category + " / " + row.subcategory;
            if (row.productGroup != null && !row.productGroup.isEmpty()) {
                taxonomy += " / " + row.productGroup;
            }

            Button productBtn = new Button(this);
            productBtn.setAllCaps(false);
            productBtn.setText(getCategoryIcon(row.category) + " " + row.name + "\n" + row.code + " • " + taxonomy + " • " + row.total + " colli");
            productBtn.setTextColor(0xFFFFFFFF);
            productBtn.setTextSize(18f);
            productBtn.setBackgroundResource(R.drawable.bg_toolbar_button_dark);
            productBtn.setMinHeight(dp(72));
            productBtn.setMinimumHeight(dp(72));
            productBtn.setPadding(dp(14), dp(10), dp(14), dp(10));
            productBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    showWarehousePositionsDialog(row);
                }
            });
            productButtons.add(productBtn);
        }

        if (!productButtons.isEmpty()) {
            addButtonsInTwoColumns(warehouseSubcategoryRow, productButtons);
        } else {
            TextView empty = new TextView(this);
            empty.setText("Nessun prodotto per i filtri selezionati");
            empty.setTextColor(0xFFD1D5DB);
            empty.setTextSize(17f);
            empty.setPadding(dp(10), dp(12), dp(10), dp(12));
            warehouseSubcategoryRow.addView(empty);
        }
    }

    private void appendWarehouseProductRow(ProductRow row) {
        if (row == null) return;
        visibleWarehouseRows.add(row);
        String taxonomy = row.category + " / " + row.subcategory;
        if (row.productGroup != null && !row.productGroup.isEmpty()) {
            taxonomy += " / " + row.productGroup;
        }
        warehouseProductsAdapter.add(getCategoryIcon(row.category) + " " + row.name + "\n" + row.code + " • " + taxonomy + " • " + row.total + " colli");
    }

    private void showWarehouseGroupProductsDialog(String groupLabel, final List<ProductRow> rows) {
        if (rows == null || rows.isEmpty()) return;

        final List<String> items = new ArrayList<String>();
        for (int i = 0; i < rows.size(); i++) {
            ProductRow row = rows.get(i);
            String taxonomy = row.category + " / " + row.subcategory;
            if (row.productGroup != null && !row.productGroup.isEmpty()) {
                taxonomy += " / " + row.productGroup;
            }
            items.add(getCategoryIcon(row.category) + " " + row.name + "\n" + row.code + " • " + taxonomy + " • " + row.total + " colli");
        }

        final ListView listView = new ListView(this);
        listView.setBackgroundColor(0xFF111827);
        listView.setDividerHeight(dp(1));
        listView.setDivider(roundedDrawable(0xFF334155, 0xFF334155, 0, 0));
        listView.setPadding(dp(4), dp(4), dp(4), dp(4));
        listView.setCacheColorHint(0x00000000);
        listView.setSelector(android.R.color.transparent);

        ArrayAdapter<String> adapter = new ArrayAdapter<String>(this, R.layout.row_operatorlite_list_item, R.id.rowText, items);
        listView.setAdapter(adapter);
        listView.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                if (position < 0 || position >= rows.size()) return;
                showWarehousePositionsDialog(rows.get(position));
            }
        });

        AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle("Prodotti gruppo " + groupLabel)
            .setView(listView)
            .setNegativeButton(R.string.cancel, null)
            .create();
        dlg.show();
        styleDialogButtons(dlg);
        styleDialogWindowTop(dlg, 700, 460);
    }

    private List<String> getWarehouseSubcategories(String category) {
        List<String> subcategories = new ArrayList<String>();
        for (ProductRow row : productRows) {
            if (row == null) continue;
            if (!matchesWarehouseCategory(row, category)) continue;
            String sub = row.subcategory == null ? "" : row.subcategory.trim();
            if (sub.isEmpty() || "NON CLASSIFICATA".equalsIgnoreCase(sub)) continue;
            if (!subcategories.contains(sub)) subcategories.add(sub);
        }
        Collections.sort(subcategories);
        return subcategories;
    }

    private List<String> getWarehouseGroups(String category, String subcategory) {
        List<String> groups = new ArrayList<String>();
        for (ProductRow row : productRows) {
            if (row == null) continue;
            if (!matchesWarehouseCategory(row, category)) continue;
            if (!matchesWarehouseSubcategory(row, subcategory)) continue;
            String groupKey = normalizeGroupKey(row.productGroup);
            if (!groups.contains(groupKey)) groups.add(groupKey);
        }
        Collections.sort(groups, new Comparator<String>() {
            @Override
            public int compare(String a, String b) {
                if (GROUP_NONE_KEY.equals(a) && GROUP_NONE_KEY.equals(b)) return 0;
                if (GROUP_NONE_KEY.equals(a)) return 1;
                if (GROUP_NONE_KEY.equals(b)) return -1;
                return a.compareToIgnoreCase(b);
            }
        });
        return groups;
    }

    private void refreshWarehouseSelectedGroupArticleIds() {
        warehouseSelectedGroupArticleIds.clear();
        if (warehouseGroup == null) return;

        for (ProductRow row : productRows) {
            if (row == null || row.articleId == null || row.articleId.trim().isEmpty()) continue;
            if (!matchesWarehouseCategory(row, warehouseCategory)) continue;
            if (!matchesWarehouseSubcategory(row, warehouseSubcategory)) continue;
            if (!matchesWarehouseGroup(row, warehouseGroup)) continue;
            if (!warehouseSelectedGroupArticleIds.contains(row.articleId)) {
                warehouseSelectedGroupArticleIds.add(row.articleId);
            }
        }
    }

    private String normalizeFilterValue(String value) {
        if (value == null) return "";
        String norm = value.replace('\u00A0', ' ').trim().toUpperCase(Locale.ROOT);
        return norm.replaceAll("\\s+", " ");
    }

    private boolean matchesWarehouseCategory(ProductRow row, String selectedCategory) {
        if (selectedCategory == null) return true;
        if (row == null) return false;
        return normalizeFilterValue(selectedCategory).equals(normalizeFilterValue(row.category));
    }

    private boolean matchesWarehouseSubcategory(ProductRow row, String selectedSubcategory) {
        if (selectedSubcategory == null) return true;
        if (row == null) return false;
        return normalizeFilterValue(selectedSubcategory).equals(normalizeFilterValue(row.subcategory));
    }

    private boolean matchesWarehouseGroup(ProductRow row, String selectedGroupKey) {
        if (selectedGroupKey == null) return true;
        if (row == null) return false;

        String rowKey = normalizeGroupKey(row.productGroup);
        if (selectedGroupKey.equals(rowKey)) return true;

        String rowRaw = normalizeFilterValue(row.productGroup);
        if (GROUP_NONE_KEY.equals(selectedGroupKey)) {
            return rowRaw.isEmpty();
        }

        String selectedRaw = normalizeFilterValue(selectedGroupKey);
        if (rowRaw.isEmpty() || selectedRaw.isEmpty()) return false;

        return rowRaw.equals(selectedRaw);
    }

    private void showWarehousePositionDetails(String positionCode, List<WarehouseEntryItem> items) {
        if (items == null || items.isEmpty()) {
            toast(R.string.warehouse_empty);
            return;
        }

        String[] lines = new String[items.size()];
        for (int i = 0; i < items.size(); i++) {
            WarehouseEntryItem it = items.get(i);
            String batch = (it.batch == null || it.batch.isEmpty()) ? "-" : it.batch;
            String line = it.articleName + "\n" + it.articleCode + " • " + it.availableQuantity + " disp. • Lotto " + batch;
            if (it.reservedQuantity > 0) {
                line += " • " + it.reservedQuantity + " pren.";
            }
            lines[i] = line;
        }

        AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle("Posizione " + positionCode)
            .setItems(lines, null)
            .setNegativeButton(R.string.cancel, null)
            .create();
        dlg.show();
        styleDialogButtons(dlg);
    }

    private void showWarehousePositionsDialog(final ProductRow row) {
        if (row.entries == null || row.entries.isEmpty()) {
            toast(R.string.warehouse_empty);
            return;
        }

        final String[] items = new String[row.entries.size()];
        for (int i = 0; i < row.entries.size(); i++) {
            ShelfEntry en = row.entries.get(i);
            String batch = (en.batch == null || en.batch.isEmpty()) ? "-" : en.batch;
            items[i] = "Pos " + en.positionCode + " • Disp " + en.quantity + " • Lotto " + batch;
        }

        AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle(getString(R.string.warehouse_positions_title, row.code))
            .setItems(items, null)
            .setNegativeButton(R.string.cancel, null)
            .create();
        dlg.show();
        styleDialogButtons(dlg);
    }

    private void showOrderLineActionsDialog(final int lineIndex) {
        final OrderLine line = orderLines.get(lineIndex);
        final CharSequence[] actions = new CharSequence[] {
            getString(R.string.line_action_edit_qty),
            getString(R.string.line_action_remove)
        };

        AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle(getString(R.string.line_actions_title, line.articleCode))
            .setItems(actions, new android.content.DialogInterface.OnClickListener() {
                @Override
                public void onClick(android.content.DialogInterface dialog, int which) {
                    if (which == 0) {
                        showEditLineQuantityDialog(lineIndex);
                    } else if (which == 1) {
                        orderLines.remove(lineIndex);
                        refreshOrderLinesUi();
                        toast(R.string.line_removed);
                    }
                }
            })
            .setNegativeButton(R.string.cancel, null)
            .create();
        dlg.show();
        styleDialogButtons(dlg);
    }

    private void showEditLineQuantityDialog(final int lineIndex) {
        final OrderLine line = orderLines.get(lineIndex);
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_NUMBER);
        input.setText(String.valueOf(line.quantity));
        input.setSelection(input.getText().length());

        AlertDialog dlg = new AlertDialog.Builder(this)
            .setTitle(getString(R.string.dialog_edit_qty_title, line.articleName, line.positionCode))
            .setView(input)
            .setPositiveButton(R.string.save, new android.content.DialogInterface.OnClickListener() {
                @Override
                public void onClick(android.content.DialogInterface dialog, int which) {
                    int qty;
                    try {
                        qty = Integer.parseInt(input.getText().toString().trim());
                    } catch (Exception ex) {
                        qty = 0;
                    }

                    if (qty <= 0) {
                        toast(R.string.qty_invalid);
                        return;
                    }

                    int maxAllowed = getAvailableForShelfEntry(line.shelfEntryId, lineIndex);
                    if (qty > maxAllowed) {
                        toast(getString(R.string.qty_exceeds, maxAllowed));
                        return;
                    }

                    line.quantity = qty;
                    refreshOrderLinesUi();
                    toast(R.string.line_updated);
                }
            })
            .setNegativeButton(R.string.cancel, null)
            .create();
        dlg.show();
        styleDialogButtons(dlg);
        styleDialogField(input);
        styleDialogWindowTop(dlg, 520, 300);
    }

    private int getAvailableForShelfEntry(long shelfEntryId, int excludeLineIndex) {
        int baseAvailable = 0;
        for (ProductRow row : productRows) {
            if (row.entries == null) continue;
            for (ShelfEntry entry : row.entries) {
                if (entry.id == shelfEntryId) {
                    baseAvailable = entry.quantity;
                    break;
                }
            }
            if (baseAvailable > 0) break;
        }

        int reserved = 0;
        for (int i = 0; i < orderLines.size(); i++) {
            if (i == excludeLineIndex) continue;
            OrderLine line = orderLines.get(i);
            if (line.shelfEntryId == shelfEntryId) {
                reserved += line.quantity;
            }
        }
        int remaining = baseAvailable - reserved;
        return Math.max(0, remaining);
    }

    private void confirmInstantOrder() {
        if (token == null || token.trim().isEmpty()) {
            toast(R.string.login_required);
            return;
        }
        if (orderLines.isEmpty()) {
            toast(R.string.no_lines);
            return;
        }

        setStatus(getString(R.string.status_sending_order));

        runInBackground(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONObject payload = new JSONObject();
                    payload.put("clientName", "Banco");
                    if (currentUserId > 0) {
                        payload.put("assignedOperatorId", currentUserId);
                    } else {
                        payload.put("assignedOperatorId", JSONObject.NULL);
                    }

                    JSONArray items = new JSONArray();
                    for (OrderLine line : orderLines) {
                        JSONObject item = new JSONObject();
                        item.put("articleId", line.articleId);
                        item.put("quantity", line.quantity);
                        item.put("positionCode", line.positionCode);
                        item.put("shelfEntryId", line.shelfEntryId);
                        if (line.batch == null || line.batch.isEmpty()) {
                            item.put("batch", JSONObject.NULL);
                        } else {
                            item.put("batch", line.batch);
                        }
                        items.put(item);
                    }
                    payload.put("items", items);

                    httpPostJson(API_URL + "/orders/instant-complete", payload, token);

                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            toast(R.string.order_sent_ok);
                            orderLines.clear();
                            refreshOrderLinesUi();
                            loadInstantData();
                        }
                    });
                } catch (final Exception ex) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            setStatus(getString(R.string.status_error, ex.getMessage()));
                            toast(getString(R.string.order_send_error, ex.getMessage()));
                        }
                    });
                }
            }
        });
    }

    private JSONArray httpGetArray(String endpoint, String bearerToken) throws Exception {
        String content = httpRequest(endpoint, "GET", null, bearerToken);
        return new JSONArray(content);
    }

    private JSONArray httpGetArraySafe(String endpoint, String bearerToken) {
        try {
            return httpGetArray(endpoint, bearerToken);
        } catch (Exception ex) {
            return new JSONArray();
        }
    }

    private JSONObject httpPostJson(String endpoint, JSONObject body, String bearerToken) throws Exception {
        String content = httpRequest(endpoint, "POST", body.toString(), bearerToken);
        return new JSONObject(content);
    }

    private String httpRequest(String endpoint, String method, String body, String bearerToken) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(endpoint);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(15000);
            conn.setUseCaches(false);
            conn.setRequestProperty("Accept", "application/json");

            if (bearerToken != null && !bearerToken.trim().isEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer " + bearerToken);
            }

            if (body != null) {
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                OutputStream os = conn.getOutputStream();
                os.write(body.getBytes("UTF-8"));
                os.flush();
                os.close();
            }

            int code = conn.getResponseCode();
            InputStream stream = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
            String response = readStream(stream);

            if (code < 200 || code >= 300) {
                throw new IOException("HTTP " + code + " - " + response);
            }
            return response;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String readStream(InputStream input) throws IOException {
        if (input == null) return "";
        BufferedReader br = new BufferedReader(new InputStreamReader(input));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line);
        }
        br.close();
        return sb.toString();
    }

    private String normalizeId(Object value) {
        if (value == null) return "";
        String s = String.valueOf(value).trim();
        return s.equals("null") ? "" : s;
    }

    private double parseWeightPerCollo(String code, String name) {
        String source = (code == null || code.trim().isEmpty()) ? name : code;
        if (source == null) return 9999d;

        Pattern p1 = Pattern.compile("-(\\d+(?:[\\.,]\\d+)?)\\s*(?:KG)?\\s*$", Pattern.CASE_INSENSITIVE);
        Matcher m1 = p1.matcher(source);
        if (m1.find()) {
            return safeDouble(m1.group(1), 9999d);
        }

        Pattern p2 = Pattern.compile("(\\d+(?:[\\.,]\\d+)?)\\s*KG", Pattern.CASE_INSENSITIVE);
        Matcher m2 = p2.matcher(source);
        if (m2.find()) {
            return safeDouble(m2.group(1), 9999d);
        }
        return 9999d;
    }

    private double safeDouble(String text, double fallback) {
        try {
            if (text == null) return fallback;
            return Double.parseDouble(text.replace(',', '.'));
        } catch (Exception ex) {
            return fallback;
        }
    }

    private void runInBackground(Runnable task) {
        ioExecutor.execute(task);
    }

    private void setStatus(String text) {
        if (txtStatus != null) txtStatus.setText(text);
    }

    private void setLoginStatus(String text) {
        if (txtLoginStatus != null) txtLoginStatus.setText(text);
    }

    private String buildJsonFingerprint(JSONArray... arrays) {
        if (arrays == null || arrays.length == 0) return "empty";

        StringBuilder sb = new StringBuilder();
        for (JSONArray arr : arrays) {
            if (arr == null) {
                sb.append("null;");
            } else {
                sb.append(arr.toString()).append(';');
            }
        }
        return Integer.toHexString(sb.toString().hashCode());
    }

    private void startAutoRefresh() {
        stopAutoRefresh();
        if (token == null || token.trim().isEmpty() || currentUserId <= 0) return;
        if (dashboardSection == null || dashboardSection.getVisibility() != View.VISIBLE) return;
        uiHandler.postDelayed(autoRefreshRunnable, AUTO_REFRESH_INTERVAL_MS);
    }

    private void stopAutoRefresh() {
        uiHandler.removeCallbacks(autoRefreshRunnable);
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density);
    }

    private void toast(int stringRes) {
        Toast.makeText(this, stringRes, Toast.LENGTH_SHORT).show();
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onBackPressed() {
        // In modalità operativa evitiamo uscite accidentali.
        Toast.makeText(this, R.string.back_disabled_hint, Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopAutoRefresh();
        ioExecutor.shutdownNow();
    }

    private static class Operator {
        long id;
        String username;
    }

    private static class Article {
        String id;
        String code;
        String name;
        String category;
        String subcategory;
        String productGroup;
    }

    private static class ShelfEntry {
        long id;
        String articleId;
        String positionCode;
        String batch;
        String expiry;
        int quantity;
    }

    private static class ShelfPositionInfo {
        String code;
        String description;
        boolean isActive;
    }

    private static class ProductRow {
        String articleId;
        String code;
        String name;
        String category;
        String subcategory;
        String productGroup;
        double weightPerCollo;
        int total;
        List<ShelfEntry> entries;
    }

    private static class OrderLine {
        String articleId;
        String articleName;
        String articleCode;
        long shelfEntryId;
        String positionCode;
        String batch;
        int quantity;
    }

    private static class TaskItem {
        int id;
        String title;
        boolean completed;
        boolean paused;
        String acceptedAt;
        long assignedOperatorId;
        String stateLabel;
    }

    private static class WarehouseEntryItem {
        long shelfEntryId;
        String articleId;
        String positionCode;
        String articleName;
        String articleCode;
        String batch;
        String expiry;
        int quantity;
        int reservedQuantity;
        int availableQuantity;
    }
}
