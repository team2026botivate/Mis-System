import React from "react";
import { Download } from "lucide-react";
import { generateDashboardJPEG } from "../../../utils/imageGenerator";
import DailyReportButton from "./DailyReportButton";

const DashboardHeader = ({
    ALL_COLUMNS,
    visibleColumns,
    filteredEmployees,
    employeeCommitments,
    topWorstPerformers,
    topBestPerformers,
    pendingTasks,
    departmentScores = [],
    dataSheetRows = [],
}) => {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-lg md:text-2xl font-bold text-gray-800">
                Admin Dashboard
            </h1>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <DailyReportButton dataSheetRows={dataSheetRows} />
                <button
                    onClick={() => {
                        const visibleColsList = ALL_COLUMNS.filter(col =>
                            visibleColumns[col.key] &&
                            !["nextWeekPlannedNotDone", "nextWeekPlannedNotDoneOnTime", "nextWeekCommitment"].includes(col.key)
                        );
                        const exportData = filteredEmployees.map(emp => ({
                            ...emp,
                            nextWeekPlannedWorkNotDone: employeeCommitments[emp.id]?.nextWeekPlannedWorkNotDone || emp.nextWeekPlannedWorkNotDone,
                            nextWeekPlannedWorkNotDoneOnTime: employeeCommitments[emp.id]?.nextWeekPlannedWorkNotDoneOnTime || emp.nextWeekPlannedWorkNotDoneOnTime,
                            nextWeekCommitment: employeeCommitments[emp.id]?.commitment || emp.nextWeekCommitment
                        }));
                        generateDashboardJPEG(
                            visibleColsList,
                            exportData,
                            topBestPerformers,
                            pendingTasks,
                            topWorstPerformers,
                            departmentScores
                        );
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-xs md:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Download Dashboard
                </button>
            </div>
        </div>
    );
};

export default DashboardHeader;
