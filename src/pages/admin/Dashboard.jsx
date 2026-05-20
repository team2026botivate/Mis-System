// ============ DASHBOARD PAGE ============
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LayoutDashboard, Users, Calendar, Clock, AlertTriangle, Search, ChevronDown, Download, Filter, MessageSquare, Briefcase, TrendingUp, X, MapPin, Phone, Mail, User, Info, Loader2 } from 'lucide-react';
import { getDisplayableImageUrl } from '../../utils/imageUtils';
import {
  employees,
  getTopScorers,
  getLowestScorers,
  getEmployeesByPendingTasks,
  departments,
  getWeeklyCommitmentComparison,
} from "../../data/mockData";
import EmployeesTable from "../../components/tables/EmployeesTable";
import HalfCircleChart from "../../components/charts/HalfCircleChart";
import HorizontalBarChart from "../../components/charts/HorizontalBarChart";
import VerticalBarChart from "../../components/charts/VerticalBarChart";
import DashboardHeader from "./components/DashboardHeader";
import EmployeeListSection from "./components/EmployeeListSection";
import UserDetailsModal from "./components/UserDetailsModal";
import ChartsGrid from "./components/ChartsGrid";
import DepartmentScoreChart from "../../components/charts/DepartmentScoreChart";
import { useAuth } from "../../contexts/AuthContext";


const getCurrentWeek = () => {
  const today = new Date();
  const startOfWeek = new Date(today);
  const day = today.getDay() || 7; // Make Sunday 7
  startOfWeek.setDate(today.getDate() - day + 1); // Set to Monday

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 5);

  return {
    start: startOfWeek.toISOString().split("T")[0],
    end: endOfWeek.toISOString().split("T")[0],
  };
};


// DateAssignmentToolbar removed as dates are now extracted from sheet data during submission.

const AdminDashboard = () => {
  const { user } = useAuth();
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  // Dashboard Logic
  const [dateRange, setDateRange] = useState(getCurrentWeek());

  // New State for Sheet Data
  const [loading, setLoading] = useState(true);
  const [sheetEmployees, setSheetEmployees] = useState([]);
  const [departmentScores, setDepartmentScores] = useState([]);
  const [dataSheetRows, setDataSheetRows] = useState([]);

  // Dynamic Column Labels
  const [columnLabels, setColumnLabels] = useState({
    name: "Name",
    designation: "Designation",
    target: "Target",
    actualWork: "Actual Work",
    weeklyDone: "Weekly Done %",
    weeklyOnTime: "Weekly On Time %",
    totalWork: "Total Work",
    weekPending: "Week Pending",
    allPending: "All Pending"
  });

  // Column Visibility State
  const ALL_COLUMNS = [

    { key: "name", label: columnLabels.name },
    { key: "designation", label: columnLabels.designation },
    { key: "target", label: columnLabels.target },
    { key: "actualWork", label: columnLabels.actualWork },
    { key: "weeklyDone", label: columnLabels.weeklyDone },
    { key: "weeklyOnTime", label: columnLabels.weeklyOnTime },
    { key: "totalWork", label: columnLabels.totalWork },
    { key: "weekPending", label: columnLabels.weekPending },
    { key: "allPending", label: columnLabels.allPending },
    { key: "lastWeekPlannedNotDone", label: "Last Week Planned Work Not Done %" },
    { key: "lastWeekPlannedNotDoneOnTime", label: "Last Week Planned Work Not Done On Time %" },
    { key: "lastWeekCommitment", label: "Last Week Commitment" },
    { key: "nextWeekPlannedNotDone", label: columnLabels.nextWeekPlannedNotDone },
    { key: "nextWeekPlannedNotDoneOnTime", label: columnLabels.nextWeekPlannedNotDoneOnTime },
    { key: "nextWeekCommitment", label: columnLabels.nextWeekCommitment },
  ];

  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const initial = {};
    ALL_COLUMNS.forEach(col => initial[col.key] = true);
    return initial;
  });

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleAllColumns = (e) => {
    const isChecked = e.target.checked;
    const newVisibility = {};
    ALL_COLUMNS.forEach(col => newVisibility[col.key] = isChecked);
    setVisibleColumns(newVisibility);
  };

  const [selectAll, setSelectAll] = useState(false);
  const [employeeCommitments, setEmployeeCommitments] = useState({});
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [filterName, setFilterName] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterHR, setFilterHR] = useState("");
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);

  // Lock body scroll when popup is open
  useEffect(() => {
    if (selectedUserDetails) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedUserDetails]);
  const [activeDrillDown, setActiveDrillDown] = useState(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);

  // New State for Data Editing
  const [editableData, setEditableData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [archivedMap, setArchivedMap] = useState({});

  // Reset editable data when selection changes
  useEffect(() => {
    if (selectedEmployees.length === 0) {
      setEditableData({});
    }
  }, [selectedEmployees]);

  // Handle Edit functionalities
  const handleInputChange = (employeeId, field, value) => {
    // Number validation (Skip for Commitment field which allows text)
    if (field !== "nextWeekCommitment" && value && !/^\d*$/.test(value)) return;

    setEditableData(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value
      }
    }));
  };

  const handleCheckboxChange = (employeeId) => {
    const alreadySelected = selectedEmployees.includes(employeeId);
    const emp = sheetEmployees.find(e => e.id === employeeId);
    if (!emp) return;

    // SELECT
    if (!alreadySelected) {
      const existing = archivedMap[emp.name];

      if (existing) {
        setEditableData(prev => ({
          ...prev,
          [employeeId]: existing.values
        }));
      } else {
        setEditableData(prev => ({
          ...prev,
          [employeeId]: {
            nextWeekPlannedNotDone: "",
            nextWeekPlannedNotDoneOnTime: "",
            nextWeekCommitment: ""
          }
        }));
      }
    }
    // UNSELECT
    else {
      setEditableData(prev => {
        const copy = { ...prev };
        delete copy[employeeId];
        return copy;
      });
    }

    handleEmployeeSelect(employeeId);
  };

  // Fetch Data from Google Sheet
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const scriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
        if (!scriptUrl) {
          console.error("VITE_APPS_SCRIPT_URL not set");
          setSheetEmployees(employees);
          setLoading(false);
          return;
        }

        // Fetch sheets
        const [recordsResponse, archivedResponse, masterResponse, dataResponse, deptScoreResponse] = await Promise.all([
          fetch(`${scriptUrl}?sheet=For Records`),
          fetch(`${scriptUrl}?sheet=Archived`),
          fetch(`${scriptUrl}?sheet=Master`),
          fetch(`${scriptUrl}?sheet=Data`),
          fetch(`${scriptUrl}?sheet=Department Score Graph`)
        ]);

        const result = await recordsResponse.json();
        const archivedResult = await archivedResponse.json();
        const masterResult = await masterResponse.json();
        const dataResult = await dataResponse.json();
        const deptScoreResult = await deptScoreResponse.json();

        // Store Data sheet rows (skip header row)
        if (dataResult.success && Array.isArray(dataResult.data)) {
          setDataSheetRows(dataResult.data.slice(1));
        }

        // Store Department Scores
        if (deptScoreResult.success && Array.isArray(deptScoreResult.data)) {
          // Column A: Name (index 0), B: Work Not Done % (index 1), C: Not Done On Time % (index 2), D: Pending (index 3)
          const parsedDeptScores = deptScoreResult.data.slice(1)
            .filter(row => row[0]) // Filter out empty names
            .map(row => ({
              name: row[0],
              workNotDonePct: parseFloat(row[1]) || 0,
              notDoneOnTimePct: parseFloat(row[2]) || 0,
              pendingWorks: parseInt(row[3]) || 0
            }));
          setDepartmentScores(parsedDeptScores);
        }

        // Build image and designation maps from Master sheet (Column A: Name, Column D: Designation, Column E: Image)
        const imageMap = {};
        const designationMap = {};
        if (masterResult.success && Array.isArray(masterResult.data)) {
          masterResult.data.slice(1).forEach(row => {
            const name = row[0] ? String(row[0]).trim().replace(/\s+/g, ' ').toLowerCase() : "";
            const designation = row[3] ? String(row[3]).trim() : "";
            const imageUrl = row[4];
            if (name) {
              if (imageUrl) imageMap[name] = imageUrl;
              if (designation) designationMap[name] = designation;
            }
          });
        }

        // Update Dynamic Headers from Archived Sheet
        if (archivedResult.success && archivedResult.data && archivedResult.data[0]) {
          const arcHeaders = archivedResult.data[0];
          setColumnLabels(prev => ({
            ...prev,
            nextWeekPlannedNotDone: arcHeaders[3] || prev.nextWeekPlannedNotDone || "Next Week Planned Work Not Done",
            nextWeekPlannedNotDoneOnTime: arcHeaders[4] || prev.nextWeekPlannedNotDoneOnTime || "Next Week Planned Work Not Done On Time",
            nextWeekCommitment: arcHeaders[5] || prev.nextWeekCommitment || "Next Week Commitment"
          }));
        }

        // Build archived map by NAME (latest entry wins)
        const newArchivedMap = {};
        const currentWeek = getCurrentWeek();

        if (archivedResult.data && Array.isArray(archivedResult.data)) {
          archivedResult.data.slice(1).forEach((row, idx) => {
            const name = row[0];
            const rowStart = row[1];
            const rowEnd = row[2];

            if (!name) return;

            const normalizeDate = (d) => {
              if (!d) return "";
              const dateObj = new Date(d);
              if (isNaN(dateObj)) return d;
              return dateObj.toISOString().split("T")[0];
            };

            const normRowStart = normalizeDate(rowStart);

            if (normRowStart < currentWeek.start || normRowStart > currentWeek.end) {
              return;
            }

            newArchivedMap[name] = {
              rowIndex: idx + 2,
              start: normRowStart,
              end: normalizeDate(rowEnd),
              values: {
                nextWeekPlannedNotDone: row[3]?.toString() || "",
                nextWeekPlannedNotDoneOnTime: row[4]?.toString() || "",
                nextWeekCommitment: row[5]?.toString() || ""
              }
            };
          });
        }

        setArchivedMap(newArchivedMap);

        if (result.success && Array.isArray(result.data)) {
          const headers = result.data[0];

          if (headers) {
            setColumnLabels(prev => ({
              ...prev,
              name: headers[2] || prev.name,
              designation: headers[3] || prev.designation,
              target: headers[3] || prev.target,
              actualWork: headers[4] || prev.actualWork,
              weeklyDone: headers[5] || prev.weeklyDone,
              weeklyOnTime: headers[6] || prev.weeklyOnTime,
              totalWork: headers[7] || prev.totalWork,
              weekPending: headers[8] || prev.weekPending,
              allPending: headers[9] || prev.allPending
            }));
          }

          const parsedData = result.data.slice(2)
            .filter(row => row[2] && String(row[2]).trim() !== "")
            .map((row, index) => {
              const randomId = `emp-${100 + index}`;
              const empName = row[2] || "Unknown";
              const normalizedName = String(empName).trim().replace(/\s+/g, ' ').toLowerCase();
              const archivedData = newArchivedMap[empName] ? newArchivedMap[empName].values : {};

              const rawImageUrl = imageMap[normalizedName];
              let finalImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(empName)}&background=0D8ABC&color=fff&size=128`;

              if (rawImageUrl) {
                const processedUrl = getDisplayableImageUrl(rawImageUrl);
                if (processedUrl) finalImageUrl = processedUrl;
              }

              return {
                id: randomId,
                name: empName,
                startDate: row[10] || "", // Column K (index 10)
                endDate: row[11] || "",   // Column L (index 11)
                designation: designationMap[normalizedName] || row[3] || "N/A",
                department: "",
                image: finalImageUrl,

                target: row[3] || 0,
                actualWorkDone: row[4] || 0,
                weeklyWorkDone: row[5] || "0%",
                weeklyWorkDoneOnTime: row[6] || "0%",
                totalWorkDone: row[7] || 0,
                weekPending: row[8] || 0,
                allPendingTillDate: row[9] || 0,

                plannedWorkNotDone: row[12] || 0,
                plannedWorkNotDoneOnTime: row[13] || 0,
                commitment: row[14] || 0,

                nextWeekPlannedWorkNotDone: row[16] || 0,
                nextWeekPlannedWorkNotDoneOnTime: row[17] || 0,
                nextWeekCommitment: row[18] || 0
              };
            });

          // Filter data if user is not an admin
          const finalData = user && user.role === 'admin'
            ? parsedData
            : parsedData.filter(emp => emp.name.toLowerCase() === (user?.name || "").toLowerCase());

          setSheetEmployees(finalData);
        } else {
          console.error("Failed to load sheet data", result);
          setSheetEmployees(employees);
        }
      } catch (error) {
        console.error("Error fetching sheet data:", error);
        setSheetEmployees(employees);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("employeeCommitments");
    if (saved) {
      setEmployeeCommitments(JSON.parse(saved));
    }
  }, []);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return sheetEmployees.filter((emp) => {
      const matchesName = emp.name.toLowerCase().includes(filterName.toLowerCase());
      const matchesDesignation = filterDepartment === "" || emp.designation === filterDepartment;
      return matchesName && matchesDesignation;
    });
  }, [sheetEmployees, filterName, filterDepartment]);

  // Get unique designations
  const uniqueDesignations = useMemo(() => [
    ...new Set(sheetEmployees.map((emp) => emp.designation).filter(Boolean)),
  ], [sheetEmployees]);

  // Statistics - Memoized
  const {
    topScorers,
    topBestPerformers,
    lowestScorers,
    commitmentComparison
  } = useMemo(() => {
    let topScorersList = [];

    if (sheetEmployees.length > 0) {
      const latestDateStr = sheetEmployees.reduce((latest, emp) => {
        if (!emp.endDate) return latest;
        const currentEnd = new Date(emp.endDate);
        if (isNaN(currentEnd)) return latest;
        if (!latest || currentEnd > new Date(latest)) return emp.endDate;
        return latest;
      }, "");

      topScorersList = sheetEmployees
        .filter(emp => emp.endDate === latestDateStr)
        .map(emp => ({
          name: emp.name,
          workDone: parseFloat(emp.actualWorkDone) || 0,  // Column E (index 4)
          totalTasks: parseFloat(emp.target) || 0,        // Column D (index 3)
          donePct: parseFloat(String(emp.weeklyWorkDone || "0").replace('%', '').trim()) || 0, // Column F (index 5)
          onTimePct: parseFloat(String(emp.weeklyWorkDoneOnTime || "0").replace('%', '').trim()) || 0, // Column G (index 6)
          allPending: parseFloat(emp.allPendingTillDate) || 0 // Column J (index 9)
        }))
        .filter(emp => emp.totalTasks > 0) // Exclude if 0 tasks in Column D
        .sort((a, b) => {
          // 1. Primary: Lowest Weekly Done % (Column F)
          if (a.donePct !== b.donePct) {
            return a.donePct - b.donePct;
          }
          // 2. Secondary: Lowest actual task done (Column E)
          if (a.workDone !== b.workDone) {
            return a.workDone - b.workDone;
          }
          // 3. Tertiary (Tie on F & E): Lowest Weekly Done On Time % (Column G)
          if (a.onTimePct !== b.onTimePct) {
            return a.onTimePct - b.onTimePct;
          }
          // 4. Quaternary: Highest All Pending Till Date (Column J)
          if (b.allPending !== a.allPending) {
            return b.allPending - a.allPending; // Higher is worse
          }
          // 5. Quinary: Higher total tasks/target (Column D) makes it worse for the same low performance
          return b.totalTasks - a.totalTasks;
        })
        .slice(0, 5);
    }

    // --- Top 5 Best Performers: most tasks done (Column E), sorted descending ---
    let topBestList = [];
    if (sheetEmployees.length > 0) {
      const latestDateStr = sheetEmployees.reduce((latest, emp) => {
        if (!emp.endDate) return latest;
        const currentEnd = new Date(emp.endDate);
        if (isNaN(currentEnd)) return latest;
        if (!latest || currentEnd > new Date(latest)) return emp.endDate;
        return latest;
      }, "");

      topBestList = sheetEmployees
        .filter(emp => emp.endDate === latestDateStr)
        .map(emp => ({
          name: emp.name,
          workDone: parseFloat(emp.actualWorkDone) || 0,  // Column E (index 4)
          totalTasks: parseFloat(emp.target) || 0,        // Column D (index 3)
          donePct: parseFloat(String(emp.weeklyWorkDone || "0").replace('%', '').trim()) || 0, // Column F (index 5)
          onTimePct: parseFloat(String(emp.weeklyWorkDoneOnTime || "0").replace('%', '').trim()) || 0, // Column G (index 6)
          allPending: parseFloat(emp.allPendingTillDate) || 0 // Column J (index 9)
        }))
        .sort((a, b) => {
          // 1. Primary: Highest Weekly Done % (Column F)
          if (b.donePct !== a.donePct) {
            return b.donePct - a.donePct;
          }
          // 2. Secondary: Highest number of task done (Column E)
          if (b.workDone !== a.workDone) {
            return b.workDone - a.workDone;
          }
          // 3. Tertiary: Highest Weekly Done On Time % (Column G)
          if (b.onTimePct !== a.onTimePct) {
            return b.onTimePct - a.onTimePct;
          }
          // 4. Quaternary: Lowest All Pending Till Date (Column J)
          if (a.allPending !== b.allPending) {
            return a.allPending - b.allPending; // Lower is better
          }
          // 5. Quinary: Higher target (Column D)
          return b.totalTasks - a.totalTasks;
        })
        .slice(0, 5);
    }

    return {
      topScorers: topScorersList.length > 0 ? topScorersList : [],
      topBestPerformers: topBestList.length > 0 ? topBestList : [],
      lowestScorers: getLowestScorers(5),
      commitmentComparison: getWeeklyCommitmentComparison()
    };
  }, [sheetEmployees, columnLabels]);

  const topScorersData = useMemo(() => topScorers.map((emp) => {
    const val = emp.donePct ?? emp.score ?? 0;
    return isNaN(val) ? 0 : val;
  }), [topScorers]);
  const topScorersLabels = useMemo(() => topScorers.map((emp) => emp.name), [topScorers]);
  const topBestData = useMemo(() => topBestPerformers.map(emp => {
    const val = emp.workDone ?? emp.score ?? 0;
    return isNaN(val) ? 0 : val;
  }), [topBestPerformers]);
  const topBestLabels = useMemo(() => topBestPerformers.map(emp => emp.name), [topBestPerformers]);
  const topBestTotalData = useMemo(() => topBestPerformers.map(emp => {
    const val = emp.totalTasks ?? 0;
    return isNaN(val) ? 0 : val;
  }), [topBestPerformers]);
  const lowestScorersData = useMemo(() => lowestScorers.map((emp) => isNaN(emp.score) ? 0 : (emp.score ?? 0)), [lowestScorers]);
  const lowestScorersLabels = useMemo(() => lowestScorers.map((emp) => emp.name), [lowestScorers]);

  // Pending Tasks by User — Column I (weekPending) sorted desc, Column D (target) as total
  const sortedPendingList = useMemo(() => {
    return [...sheetEmployees]
      .map(emp => ({
        name: emp.name,
        pending: parseFloat(emp.weekPending) || 0,
        total: parseFloat(emp.target) || 0
      }))
      .filter(emp => emp.pending > 0)
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 5);
  }, [sheetEmployees]);

  const pendingTasksData = useMemo(() => sortedPendingList.map(emp => emp.pending), [sortedPendingList]);
  const pendingTasksLabels = useMemo(() => sortedPendingList.map(emp => emp.name), [sortedPendingList]);
  const pendingTasksTotalData = useMemo(() => sortedPendingList.map(emp => emp.total), [sortedPendingList]);
  const departmentScoresData = useMemo(() => departmentScores.map((dept) => dept.workNotDonePct), [departmentScores]);
  const departmentScoresLabels = useMemo(() => departmentScores.map((dept) => dept.name), [departmentScores]);
  const departmentScoresNotDoneOnTime = useMemo(() => departmentScores.map((dept) => dept.notDoneOnTimePct), [departmentScores]);
  const departmentScoresPending = useMemo(() => departmentScores.map((dept) => dept.pendingWorks), [departmentScores]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filteredEmployees.map((emp) => emp.id));
    }
    setSelectAll(!selectAll);
  };

  const handleEmployeeSelect = (employeeId) => {
    setSelectedEmployees((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleCommitmentChange = (employeeId, field, value) => {
    if (value === "") {
      setEmployeeCommitments((prev) => ({
        ...prev,
        [employeeId]: {
          ...prev[employeeId],
          [field]: "",
        },
      }));
      return;
    }

    if (field === "commitment") {
      setEmployeeCommitments((prev) => ({
        ...prev,
        [employeeId]: {
          ...prev[employeeId],
          [field]: value,
        },
      }));
    } else {
      const num = parseInt(value);
      if (!isNaN(num)) {
        setEmployeeCommitments((prev) => ({
          ...prev,
          [employeeId]: {
            ...prev[employeeId],
            [field]: num,
          },
        }));
      }
    }
  };

  const handleRowClick = (employee) => {
    const personName = String(employee.name).trim().replace(/\s+/g, ' ').toLowerCase();
    const matchingRows = dataSheetRows.filter(row => {
      const dataName = row[4] ? String(row[4]).trim().replace(/\s+/g, ' ').toLowerCase() : "";
      return dataName === personName;
    });

    const tasks = matchingRows.map(row => ({
      fmsName: row[2] || "",
      taskName: row[3] || "",
      nameColRef: row[6] || "",
      taskNameColRef: row[26] || "",
      department: row[0] || "",
      sheetId: row[5] || "",
      scriptUrl: row[25] || "",
      plannedSheetRef: row[7] || "",
      actualSheetRef: row[8] || "",
      target: row[10] || 0,
      totalAchievement: row[11] || 0,
      workNotDone: row[12] || 0,
      workNotDoneOnTime: row[13] || 0,
      allPendingTillDate: row[14] || 0,
      delayColRef: row[27] || ""
    }));

    setSelectedUserDetails({ ...employee, tasks });
  };

  // Helper: Parse sheet reference like "FMS 1!O7:O"
  const parseSheetRef = (ref) => {
    if (!ref) return null;
    const str = String(ref).trim();
    const bangIndex = str.indexOf("!");
    if (bangIndex === -1) return { sheetName: str, colIndex: -1, startRowIndex: 0 };
    const sheetName = str.substring(0, bangIndex);
    const rangePart = str.substring(bangIndex + 1);

    const colMatch = rangePart.match(/^([A-Za-z]+)(\d*)/);
    if (!colMatch) return { sheetName, colIndex: -1, startRowIndex: 0 };

    const colLetter = colMatch[1].toUpperCase();
    let colIndex = 0;
    for (let i = 0; i < colLetter.length; i++) {
      colIndex = colIndex * 26 + (colLetter.charCodeAt(i) - 64);
    }
    colIndex -= 1;

    const startRow = colMatch[2] ? parseInt(colMatch[2]) : 1;
    const startRowIndex = startRow > 0 ? startRow - 1 : 0;

    return { sheetName, colIndex, startRowIndex };
  };

  const handleDrillDown = async (task, type, value, event) => {
    event.stopPropagation();

    const scriptUrl = String(task.scriptUrl || "").trim();

    const plannedParsed = parseSheetRef(task.plannedSheetRef);
    const actualParsed = parseSheetRef(task.actualSheetRef);
    const nameParsed = parseSheetRef(task.nameColRef);
    const taskNameParsed = parseSheetRef(task.taskNameColRef);
    const delayParsed = parseSheetRef(task.delayColRef);

    setDrillDownLoading(true);
    setActiveDrillDown({
      taskId: task.taskName,
      type,
      title: `Total Achievement Details`,
      rows: [],
      loading: true
    });

    try {
      const employeeName = String(selectedUserDetails?.name || "").trim().replace(/\s+/g, ' ').toLowerCase();

      console.log("--- DRILLDOWN DEBUG START ---");
      console.log("Task details:", task);
      console.log("Employee to search:", employeeName);
      console.log("Parsed refs:", { plannedParsed, actualParsed, nameParsed, taskNameParsed, delayParsed });

      const sheetDataCache = {};
      const sheetsToFetch = new Set();
      if (plannedParsed?.sheetName) sheetsToFetch.add(plannedParsed.sheetName);
      if (actualParsed?.sheetName) sheetsToFetch.add(actualParsed.sheetName);
      if (nameParsed?.sheetName) sheetsToFetch.add(nameParsed.sheetName);
      if (taskNameParsed?.sheetName) sheetsToFetch.add(taskNameParsed.sheetName);
      if (delayParsed?.sheetName) sheetsToFetch.add(delayParsed.sheetName);

      console.log("Sheets list to fetch:", Array.from(sheetsToFetch));

      window.__sheetDataCache = window.__sheetDataCache || {};
      const mainScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL || "";
      const spreadsheetId = String(task.sheetId || "").trim();
      const sheetFetchErrors = {};

      const fetchPromises = [...sheetsToFetch].map(async (name) => {
        const urlsToTry = [scriptUrl, mainScriptUrl]
          .map(u => String(u || "").trim())
          .filter(u => u.startsWith("http"));
        let success = false;
        const errors = [];

        for (const url of urlsToTry) {
          const cacheKey = `${url}|${spreadsheetId}|${name}`;
          if (window.__sheetDataCache[cacheKey]) {
            sheetDataCache[name] = window.__sheetDataCache[cacheKey];
            success = true;
            break;
          } else {
            try {
              const separator = url.includes('?') ? '&' : '?';
              let fetchUrl = `${url}${separator}sheet=${encodeURIComponent(name)}`;
              if (spreadsheetId) {
                fetchUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
              }

              const res = await fetch(fetchUrl);
              
              if (!res.ok) {
                throw new Error(`HTTP error ${res.status}`);
              }
              
              const result = await res.json();
              if (result.success && Array.isArray(result.data)) {
                sheetDataCache[name] = result.data;
                window.__sheetDataCache[cacheKey] = result.data;
                success = true;
                break;
              } else {
                throw new Error(result.message || result.error || "API returned success: false or invalid format");
              }
            } catch (err) {
              console.error(`Fetch failed for sheet ${name} using url ${url}:`, err);
              errors.push(`${url}: ${err.message}`);
            }
          }
        }

        if (!success) {
          sheetDataCache[name] = [];
          sheetFetchErrors[name] = errors;
        }
      });
      await Promise.all(fetchPromises);

      const formatDateValue = (val) => {
        if (val === undefined || val === null || val === "") return "";
        const str = String(val);
        const d = new Date(str);
        if (!isNaN(d.getTime()) && (str.includes("T") || str.includes("-") || str.includes("/"))) {
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, "0");
          const min = String(d.getMinutes()).padStart(2, "0");
          const ss = String(d.getSeconds()).padStart(2, "0");
          return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
        }
        return str;
      };

      const formatDurationValue = (val) => {
        if (val === undefined || val === null || val === "") return "";
        const str = String(val).toLowerCase();

        // Handle ISO Date strings (often used for durations in Sheet JSON)
        const d = new Date(val);
        if (!isNaN(d.getTime()) && (String(val).includes("T") || String(val).includes("-"))) {
          // Check if it's near the spreadsheet epoch (1899/1900)
          const year = d.getUTCFullYear();
          if (year <= 1900) {
            // Spreadsheet epoch is usually Dec 30, 1899
            const epoch = new Date(Date.UTC(1899, 11, 30));
            const diffMs = d.getTime() - epoch.getTime();
            const totalSeconds = Math.floor(diffMs / 1000);

            if (totalSeconds >= 0) {
              const h = Math.floor(totalSeconds / 3600);
              const m = Math.floor((totalSeconds % 3600) / 60);
              const s = totalSeconds % 60;
              return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }
          }
          // For other dates, just show the time part as a fallback
          const hh = String(d.getHours()).padStart(2, "0");
          const mm = String(d.getMinutes()).padStart(2, "0");
          const ss = String(d.getSeconds()).padStart(2, "0");
          return `${hh}:${mm}:${ss}`;
        }

        // Handle "X day Y hr Z min" format
        if (str.includes("day") || str.includes("hour") || str.includes("hr") || str.includes("min")) {
          let days = 0, hours = 0, minutes = 0, seconds = 0;
          const dayMatch = str.match(/(\d+)\s*day/);
          const hrMatch = str.match(/(\d+)\s*(hour|hr)/);
          const minMatch = str.match(/(\d+)\s*min/);
          const secMatch = str.match(/(\d+)\s*sec/);

          if (dayMatch) days = parseInt(dayMatch[1]);
          if (hrMatch) hours = parseInt(hrMatch[1]);
          if (minMatch) minutes = parseInt(minMatch[1]);
          if (secMatch) seconds = parseInt(secMatch[1]);

          const totalHours = (days * 24) + hours;
          return `${String(totalHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }

        // Handle numeric durations (fractions of a day)
        if (!isNaN(val) && !isNaN(parseFloat(val))) {
          const totalSeconds = Math.round(parseFloat(val) * 24 * 60 * 60);
          const h = Math.floor(totalSeconds / 3600);
          const m = Math.floor((totalSeconds % 3600) / 60);
          const s = totalSeconds % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        }

        return String(val);
      };

      let matchingRowIndices = null;

      if (nameParsed && nameParsed.sheetName && nameParsed.colIndex >= 0) {
        const nameSheetRows = sheetDataCache[nameParsed.sheetName] || [];
        console.log(`Matching name in sheet ${nameParsed.sheetName}. Rows found in cache:`, nameSheetRows.length);
        const nameRowsFromStart = nameParsed.startRowIndex > 0
          ? nameSheetRows.slice(nameParsed.startRowIndex)
          : nameSheetRows;

        const tempIndices = [];
        nameRowsFromStart.forEach((row, idx) => {
          const nameInSheet = row[nameParsed.colIndex] ? String(row[nameParsed.colIndex]).trim().replace(/\s+/g, ' ').toLowerCase() : "";
          if (nameInSheet === employeeName) {
            tempIndices.push(idx);
          }
        });

        console.log(`Matched name indices for "${employeeName}":`, tempIndices);

        // If name matching found results, use them; otherwise show all rows (fallback)
        if (tempIndices.length > 0) {
          matchingRowIndices = tempIndices;
        } else {
          console.warn(`No rows matched employeeName "${employeeName}" in column index ${nameParsed.colIndex}. Falling back to all rows.`);
          matchingRowIndices = null;
        }
      }

      const getColumnValues = (parsed, formatter = formatDateValue) => {
        if (!parsed || !parsed.sheetName || parsed.colIndex < 0) return [];
        const allRows = sheetDataCache[parsed.sheetName] || [];
        const rowsFromStart = parsed.startRowIndex > 0 ? allRows.slice(parsed.startRowIndex) : allRows;

        if (matchingRowIndices !== null) {
          return matchingRowIndices.map(idx =>
            rowsFromStart[idx] !== undefined ? formatter(rowsFromStart[idx][parsed.colIndex]) : ""
          );
        } else {
          return rowsFromStart.map(row => formatter(row[parsed.colIndex]));
        }
      };

      const plannedValues = getColumnValues(plannedParsed);
      const actualValues = getColumnValues(actualParsed);
      const delayValues = getColumnValues(delayParsed, formatDurationValue);

      const targetSheetName = plannedParsed?.sheetName || nameParsed?.sheetName;
      const allTargetRows = sheetDataCache[targetSheetName] || [];
      const targetRowsFromStart = (plannedParsed?.startRowIndex > 0 ? allTargetRows.slice(plannedParsed.startRowIndex) : allTargetRows);

      const getTaskNameFromRow = (row) => {
        if (!row) return "";
        // 1. If taskNameParsed is valid, use it
        if (taskNameParsed && taskNameParsed.colIndex >= 0 && row[taskNameParsed.colIndex]) {
          return String(row[taskNameParsed.colIndex]).trim();
        }
        // 2. Fallback: search columns D, C, B in that order (common columns for step/stage names)
        const possibleIndices = [3, 2, 1];
        for (const colIdx of possibleIndices) {
          if (row[colIdx] && String(row[colIdx]).trim() !== "" && colIdx !== nameParsed?.colIndex) {
            const val = String(row[colIdx]).trim();
            // Ignore if it's a date or a number
            const isDate = val.includes("/") || val.includes("-") || val.includes(":");
            if (!isDate) return val;
          }
        }
        // 3. Fallback to nameParsed column if nothing else found
        if (nameParsed && nameParsed.colIndex >= 0 && row[nameParsed.colIndex]) {
          return String(row[nameParsed.colIndex]).trim();
        }
        return "";
      };

      const rows = [];
      if (matchingRowIndices !== null) {
        matchingRowIndices.forEach((idx, listIdx) => {
          const row = targetRowsFromStart[idx];
          if (!row) return;

          const taskName = getTaskNameFromRow(row);
          const planned = plannedValues[listIdx] || "";
          const actual = actualValues[listIdx] || "";
          const delayVal = delayValues[listIdx] || "";

          if (taskName || planned || actual) {
            rows.push({
              taskName,
              planned,
              actual,
              delay: delayVal
            });
          }
        });
      } else {
        targetRowsFromStart.forEach((row, idx) => {
          const taskName = getTaskNameFromRow(row);
          const planned = plannedValues[idx] || "";
          const actual = actualValues[idx] || "";
          const delayVal = delayValues[idx] || "";

          if (taskName || planned || actual) {
            rows.push({
              taskName,
              planned,
              actual,
              delay: delayVal
            });
          }
        });
      }

      console.log("Final generated drilldown rows:", rows);
      console.log("--- DRILLDOWN DEBUG END ---");

      setActiveDrillDown({
        taskId: task.taskName,
        type,
        title: `Total Achievement Details`,
        rows,
        loading: false,
        rowsCount: targetRowsFromStart.length,
        sheetsFetched: {
          [targetSheetName]: allTargetRows.map(r => r[0] || "").slice(0, 10)
        },
        errors: sheetFetchErrors
      });
    } catch (error) {
      console.error("Error fetching drill-down data:", error);
      setActiveDrillDown({
        taskId: task.taskName,
        type,
        title: `Total Achievement Details`,
        rows: [],
        loading: false,
        error: error.message
      });
    } finally {
      setDrillDownLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const scriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;

      for (const id of selectedEmployees) {
        const emp = sheetEmployees.find(e => e.id === id);
        const inputs = editableData[id] || {};

        const row = [
          emp.name,
          emp.startDate,
          emp.endDate,
          inputs.nextWeekPlannedNotDone || "",
          inputs.nextWeekPlannedNotDoneOnTime || "",
          inputs.nextWeekCommitment || ""
        ];

        const existing = archivedMap[emp.name];

        const payload = existing
          ? {
            action: "update",
            sheetName: "Archived",
            rowIndex: existing.rowIndex,
            rowData: JSON.stringify(row)
          }
          : {
            action: "insert",
            sheetName: "Archived",
            rowData: JSON.stringify(row)
          };

        const response = await fetch(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(payload)
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to save row");
        }
      }

      alert("Saved successfully ✅");
      setSelectedEmployees([]);
      setEditableData({});
      setSelectAll(false);

    } catch (error) {
      console.error(error);
      alert(`Stopped: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6 p-2 md:p-4">
      {/* Header */}
      <DashboardHeader
        ALL_COLUMNS={ALL_COLUMNS}
        visibleColumns={visibleColumns}
        filteredEmployees={filteredEmployees}
        employeeCommitments={employeeCommitments}
        topWorstPerformers={topScorers}
        topBestPerformers={topBestPerformers}
        pendingTasks={sortedPendingList}
        departmentScores={departmentScores}
        dataSheetRows={dataSheetRows}
      />

      {/* Employee List */}
      <EmployeeListSection
        ALL_COLUMNS={ALL_COLUMNS}
        visibleColumns={visibleColumns}
        showColumnFilter={showColumnFilter}
        setShowColumnFilter={setShowColumnFilter}
        toggleColumn={toggleColumn}
        toggleAllColumns={toggleAllColumns}
        columnLabels={columnLabels}
        filterName={filterName}
        setFilterName={setFilterName}
        filterDepartment={filterDepartment}
        setFilterDepartment={setFilterDepartment}
        uniqueDesignations={uniqueDesignations}
        handleSubmit={handleSubmit}
        selectedEmployees={selectedEmployees}
        submitting={submitting}
        loading={loading}
        filteredEmployees={filteredEmployees}
        selectAll={selectAll}
        handleSelectAll={handleSelectAll}
        handleCheckboxChange={handleCheckboxChange}
        handleEmployeeSelect={handleEmployeeSelect}
        handleRowClick={handleRowClick}
        editableData={editableData}
        handleInputChange={handleInputChange}
        expandedEmployee={expandedEmployee}
        setExpandedEmployee={setExpandedEmployee}
        employeeCommitments={employeeCommitments}
        handleCommitmentChange={handleCommitmentChange}
      />

      {/* Modals (User Details + Drill Down) */}
      <UserDetailsModal
        selectedUserDetails={selectedUserDetails}
        setSelectedUserDetails={setSelectedUserDetails}
        activeDrillDown={activeDrillDown}
        setActiveDrillDown={setActiveDrillDown}
        handleDrillDown={handleDrillDown}
      />

      {/* Charts */}
      <ChartsGrid
        user={user}
        loading={loading}
        topScorersData={topScorersData}
        topScorersLabels={topScorersLabels}
        pendingTasksData={pendingTasksData}
        pendingTasksLabels={pendingTasksLabels}
        pendingTasksTotalData={pendingTasksTotalData}
        topBestData={topBestData}
        topBestLabels={topBestLabels}
        topBestTotalData={topBestTotalData}
      />

      {/* Department Scores */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 lg:p-8 mt-6">
        <h2 className="text-sm md:text-base font-bold text-gray-800 flex items-center gap-2 mb-6">
          <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
          Department Scores
        </h2>
        <div className="h-[400px] md:h-[500px]">
          <DepartmentScoreChart
            labels={departmentScoresLabels}
            pendingData={departmentScoresPending}
            notDoneData={departmentScoresData}
            notDoneOnTimeData={departmentScoresNotDoneOnTime}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
