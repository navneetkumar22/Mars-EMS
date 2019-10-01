const google = require("googleapis");
const authentication = require("../../authentication");
const config = require("../../config/spreadsheet/settings");
const axios = require("axios");
const moment = require("moment");
const reportsService = require("../services/ReportsService");
const url = require("../../config/baseUrl");

module.exports = {
  getDetails: async (req, res) => {
    const auth = await authentication.authenticate();
    // .then(auth => {
    const sheets = google.sheets("v4");
    sheets.spreadsheets.values.get(
      {
        auth: auth,
        spreadsheetId: config.spreadsheetSettings.spreadsheetId, // id of spreadsheet
        range: config.spreadsheetSettings.employeeSheetId // name of employee spreadsheet and range- get all cells
      },
      (err, response) => {
        if (err) {
          res.serverError(err);
          return;
        }
        const rows = response.values; // response-all cells
        const updatedData = reportsService.giveMeEmps(rows);

        let apiData = getApiData();
        let fullData = {};

        // Getting the relevant FULL salary info
        let salaryData = [];
        let empData = [];

        // HERE GOES THE DATES/ EMPLOYEE CALCULATIONS:
        setTimeout(() => {
          let preparingData = relevantEmps(apiData, updatedData);

          // Sending the req to get the unique salary data
          preparingData.map(name => {
            getEmployee(name)
              .then(sal => {
                salaryData.push(sal.data);
                empData.push(name);
              })
              .catch(err => console.log(err));
          });
        }, 500);

        // Sending the server data to frontend
        setTimeout(() => {
          let onlyRelevant = relevantSalary(salaryData, apiData);
          fullData.names = empData;
          fullData.salaryInfo = onlyRelevant;
          if (rows.length === 0) {
            res.err("No data found.");
          } else {
            res.ok(fullData);
          }
        }, 1500);
      }
    );
    // });
  }
};

getApiData = () => {
  const apiData = [];
  axios
    .get(`${url.baseUrl}/api`)
    .then(res => {
      let first = Object.values(res.data.pop()).shift(); // Getting the 'selectedDate'
      apiData.push(first);
    })
    .catch(err => console.error(err));
  return apiData;
};

(relevantEmps = (one, two) => {
  let relevantNames = [];
  let finalNames = [];

  one.map(xo => {
    // let xo = 201803;
    // IF THEY STARTED WORKING BEFORE THE SELECTED DATE AND STOPPED WORKING AFTER THAT DATE
    two.forEach(emp => {
      //  2013 - 2012 - 2014
      if (
        xo > parseInt(moment(emp.startdate).format("YYYYMM"), 10) &&
        xo < parseInt(moment(emp.enddate).format("YYYYMM"), 10)
      ) {
        relevantNames.push(emp);
      }
    });

    // IF THEY STARTED WORKING BEFORE THE SELECTED DATE AND STILL WORKING
    two.forEach(emp => {
      // 2013 > 2012 & 2013   -
      if (
        xo > parseInt(moment(emp.startdate).format("YYYYMM"), 10) &&
        parseInt(moment(emp.enddate).format("YYYYMM"), 10) == undefined
      ) {
        relevantNames.push(emp);
      }
    });
    finalNames = reportsService.justNames(relevantNames);
  });
  // Getting the names to use for unique sheet req
  return finalNames;
}),
  // Getting only the relevant salary data
  (relevantSalary = (sal, api) => {
    let relevantData = [];
    sal.map(x => {
      x.map(y => {
        if (
          api ==
            parseInt(
              y.year +
                moment()
                  .month(y.month)
                  .format("MM"),
              10
            ) &&
          y.totalNetSalary !== undefined
        ) {
          relevantData.push(y);
        }
      });
    });
    return relevantData;
  }),
  // Making the req to get the relevant salary info
  (getEmployee = value => {
    return axios({
      method: "get",
      url: `${url.baseUrl}/employee/getEmployee?employeeSheetName=${value}`
    });
  });
