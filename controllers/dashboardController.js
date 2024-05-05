class DashboardController {
    dashboardPage = (req, res) => {
        const { userInfo } = req;

        res.status(200).render('dashboard/index.ejs', {
            title: 'Dashboard',
            user: userInfo
        });
    }
}

module.exports = new DashboardController();