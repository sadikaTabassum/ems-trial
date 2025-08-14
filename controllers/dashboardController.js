// controllers/DashboardController.js
const db = require("../config/db");
const formidable = require("formidable");
const oracledb = require("oracledb");

const toStr = (v) => (Array.isArray(v) ? String(v[0]) : String(v ?? ""));

class DashboardController {
  dashboardPage = (req, res) => {
    const { userInfo } = req;
    res.status(200).render("dashboard/index.ejs", {
      title: "Dashboard",
      user: userInfo,
    });
  };

  // Admin Controllers ->

  hotelPage = async (req, res) => {
    const { userInfo } = req;
    try {
      // Oracle has no TRUE/FALSE in SQL -> return 1/0 and coerce in the view if needed
      const sql = `
        SELECT DISTINCT
          H.*,
          CASE WHEN ARH.HOTEL_ID IS NOT NULL THEN 1 ELSE 0 END AS HAS_ROOMS_ASSIGNED
        FROM HOTEL H
        LEFT JOIN AVAILABLE_ROOM_PER_HOTEL ARH
          ON H.HOTEL_ID = ARH.HOTEL_ID
      `;
      const { rows } = await db.execute(
        sql,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      res.status(200).render("dashboard/hotel.ejs", {
        title: "Hotel",
        user: userInfo,
        hotels: rows,
      });
    } catch (error) {
      console.error(
        "Error fetching hotels with room assignment status:",
        error
      );
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  guestsPage = async (req, res) => {
    const { userInfo } = req;
    const sql = `SELECT * FROM USERS WHERE USER_TYPE = :role`;
    const { rows } = await db.execute(
      sql,
      { role: "client" },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.status(200).render("dashboard/guests.ejs", {
      title: "Guests",
      user: userInfo,
      guests: rows,
      error: "",
    });
  };

  updateGuestsPage = async (_req, _res) => {
    // no-op for now
  };

  addHotelPage = async (req, res) => {
    const { userInfo } = req;
    res.status(200).render("dashboard/add-hotel.ejs", {
      title: "Add Hotel",
      user: userInfo,
      error: "",
    });
  };

  addHotelRoomsPage = async (req, res) => {
    const { userInfo } = req;
    const { hotel_id } = req.params;

    const sql = `SELECT * FROM HOTEL WHERE HOTEL_ID = :id`;
    const { rows } = await db.execute(
      sql,
      { id: Number(hotel_id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const hotel = rows?.[0];

    res.status(200).render("dashboard/add-rooms.ejs", {
      title: "Add Rooms",
      user: userInfo,
      error: "",
      hotel,
    });
  };

  hotelRoomsPage = async (req, res) => {
    const { userInfo } = req;
    const { hotel_id } = req.params;

    try {
      // If GET_HOTEL_ROOMS is a table function, Oracle syntax is SELECT * FROM TABLE(func(:id))
      const sql = `SELECT * FROM TABLE(GET_HOTEL_ROOMS(:id))`;
      const { rows } = await db.execute(
        sql,
        { id: Number(hotel_id) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      res.status(200).render("dashboard/hotel-rooms.ejs", {
        title: "Hotel Rooms",
        user: userInfo,
        hotelId: hotel_id,
        rooms: rows,
      });
    } catch (error) {
      console.error("Error fetching hotel rooms:", error);
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  updateHotelRoomsPage = async (req, res) => {
    const { userInfo } = req;
    const { hotel_id } = req.params;

    try {
      const sql = `SELECT * FROM TABLE(GET_HOTEL_ROOMS(:id))`;
      const { rows } = await db.execute(
        sql,
        { id: Number(hotel_id) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      res.status(200).render("dashboard/update-rooms.ejs", {
        title: "Update Rooms",
        user: userInfo,
        hotelId: hotel_id,
        rooms: rows,
        error: "",
      });
    } catch (error) {
      console.error("Error fetching hotel rooms:", error);
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  registerHotel = async (req, res) => {
    const { userInfo } = req;
    const form = new formidable.IncomingForm({ multiples: false });

    try {
      const { fields } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields) =>
          err ? reject(err) : resolve({ fields })
        );
      });

      const hotel_name = toStr(fields.hotel_name);
      const address = toStr(fields.address);
      const state = toStr(fields.state);
      const zip_code = toStr(fields.zip_code);
      const website = toStr(fields.website);
      const phone = toStr(fields.phone);

      // check existence
      const checkSql = `SELECT COUNT(*) AS CNT FROM HOTEL WHERE HOTEL_NAME = :name`;
      const checkRes = await db.execute(
        checkSql,
        { name: hotel_name },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const exists = Number(checkRes.rows?.[0]?.CNT || 0) > 0;

      if (exists) {
        return res.status(400).render("dashboard/add-hotel.ejs", {
          title: "Add Hotel",
          user: userInfo,
          error: "Hotel with this name already exists",
        });
      }

      // call stored procedure
      const plsql = `
        BEGIN
          CREATE_HOTEL(:hotel_name, :address, :state, :zip_code, :website, :phone);
        END;`;
      await db.execute(
        plsql,
        { hotel_name, address, state, zip_code, website, phone },
        { autoCommit: true }
      );

      return res.status(200).redirect("/hotel");
    } catch (error) {
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  registerRoomsToHotel = async (req, res) => {
    const { hotel_id } = req.params;
    const form = new formidable.IncomingForm({ multiples: false });

    try {
      const { fields } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields) =>
          err ? reject(err) : resolve({ fields })
        );
      });

      const totalSmallRooms = Number.parseInt(toStr(fields.t_s_room));
      const totalMediumRooms = Number.parseInt(toStr(fields.t_m_room));
      const totalLargeRooms = Number.parseInt(toStr(fields.t_l_room));
      const availableSmallRooms = Number.parseInt(toStr(fields.a_s_room));
      const availableMediumRooms = Number.parseInt(toStr(fields.a_m_room));
      const availableLargeRooms = Number.parseInt(toStr(fields.a_l_room));

      const plsql = `
        BEGIN
          CREATE_HOTEL_ROOM(
            :hotel_id, :t_s, :t_m, :t_l, :a_s, :a_m, :a_l
          );
        END;`;
      await db.execute(
        plsql,
        {
          hotel_id: Number(hotel_id),
          t_s: totalSmallRooms,
          t_m: totalMediumRooms,
          t_l: totalLargeRooms,
          a_s: availableSmallRooms,
          a_m: availableMediumRooms,
          a_l: availableLargeRooms,
        },
        { autoCommit: true }
      );

      return res.status(200).redirect(`/view-rooms/${hotel_id}`);
    } catch (error) {
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  updateHotelRooms = async (req, res) => {
    const { hotel_id } = req.params;
    const form = new formidable.IncomingForm({ multiples: false });

    try {
      const { fields } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields) =>
          err ? reject(err) : resolve({ fields })
        );
      });

      const totalSmallRooms = Number.parseInt(toStr(fields.t_small_hall_room));
      const totalMediumRooms = Number.parseInt(
        toStr(fields.t_medium_hall_room)
      );
      const totalLargeRooms = Number.parseInt(toStr(fields.t_large_hall_room));
      const availableSmallRooms = Number.parseInt(
        toStr(fields.a_small_hall_room)
      );
      const availableMediumRooms = Number.parseInt(
        toStr(fields.a_medium_hall_room)
      );
      const availableLargeRooms = Number.parseInt(
        toStr(fields.a_large_hall_room)
      );

      // one anonymous block with 3 calls
      const plsql = `
        BEGIN
          UPDATE_HOTEL_ROOM(:hid, 'small_hall',  :t_s, :a_s);
          UPDATE_HOTEL_ROOM(:hid, 'medium_hall', :t_m, :a_m);
          UPDATE_HOTEL_ROOM(:hid, 'large_hall',  :t_l, :a_l);
        END;`;
      await db.execute(
        plsql,
        {
          hid: Number(hotel_id),
          t_s: totalSmallRooms,
          a_s: availableSmallRooms,
          t_m: totalMediumRooms,
          a_m: availableMediumRooms,
          t_l: totalLargeRooms,
          a_l: availableLargeRooms,
        },
        { autoCommit: true }
      );

      return res.status(200).redirect(`/view-rooms/${hotel_id}`);
    } catch (error) {
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  // Client Controllers ->

  eventsPage = async (req, res) => {
    const { userInfo } = req;
    const sql = `SELECT * FROM EVENT_RESERVATION WHERE GUEST_ID = :id`;
    const { rows } = await db.execute(
      sql,
      { id: Number(userInfo.id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.status(200).render("dashboard/events.ejs", {
      title: "Events",
      user: userInfo,
      events: rows,
      error: "",
    });
  };

  reserveEventPage = async (req, res) => {
    const { userInfo } = req;

    try {
      const evSql = `SELECT * FROM EVENT_TYPE`;
      const { rows: eventTypesData } = await db.execute(
        evSql,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const hSql = `SELECT * FROM HOTEL`;
      const { rows: hotelsData } = await db.execute(
        hSql,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // If this is a table function in Oracle:
      const roomsSql = `SELECT * FROM TABLE(GET_AVAILABLE_ROOMS_WITH_TYPE())`;
      const { rows: availableRoomsData } = await db.execute(
        roomsSql,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      res.status(200).render("dashboard/reserve-event.ejs", {
        title: "Reserve Event",
        user: userInfo,
        eventTypes: eventTypesData,
        hotels: hotelsData,
        rooms: availableRoomsData,
        error: "",
      });
    } catch (error) {
      console.error("Error fetching data for reserve event page:", error);
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  reserveEventRegister = async (req, res) => {
    const { userInfo } = req;
    const form = new formidable.IncomingForm({ multiples: false });

    try {
      const { fields } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields) =>
          err ? reject(err) : resolve({ fields })
        );
      });

      const event_type = Number.parseInt(toStr(fields.event_type));
      const hotel = Number.parseInt(toStr(fields.hotel));
      const room = Number.parseInt(toStr(fields.room));
      const start_date = toStr(fields.start_date); // let PL/SQL handle to_date
      const end_date = toStr(fields.end_date);
      const room_quantity = Number.parseInt(toStr(fields.room_quantity));
      const no_of_people = Number.parseInt(toStr(fields.no_of_people));
      const userId = Number(userInfo.id);

      const plsql = `
        BEGIN
          INSERT_EVENT_RESERVATION(
            :p_guest_id,
            :p_hotel_id,
            :p_event_type_id,
            :p_room_id,
            :p_start_date,
            :p_end_date,
            :p_room_qty,
            :p_discount,       -- was 0
            SYSDATE,           -- Oracle current timestamp
            :p_num_people,
            :p_status          -- was 1
          );
        END;`;
      await db.execute(
        plsql,
        {
          p_guest_id: userId,
          p_hotel_id: hotel,
          p_event_type_id: event_type,
          p_room_id: room,
          p_start_date: start_date,
          p_end_date: end_date,
          p_room_qty: room_quantity,
          p_discount: 0,
          p_num_people: no_of_people,
          p_status: 1,
        },
        { autoCommit: true }
      );

      return res.status(200).redirect("/events");
    } catch (error) {
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  eventRoomsPage = async (req, res) => {
    const { userInfo } = req;
    const { event_id } = req.params;

    try {
      const sql = `SELECT * FROM TABLE(GET_EVENT_ROOMS(:id))`;
      const { rows } = await db.execute(
        sql,
        { id: Number(event_id) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      res.status(200).render("dashboard/event-rooms.ejs", {
        title: "Event Rooms",
        user: userInfo,
        eventId: event_id,
        rooms: rows,
      });
    } catch (error) {
      console.error("Error fetching event rooms:", error);
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  addRoomsPage = async (req, res) => {
    const { userInfo } = req;
    const { event_id } = req.params;

    try {
      res.status(200).render("dashboard/add-event-rooms.ejs", {
        title: "Add Rooms",
        user: userInfo,
        eventId: event_id,
        error: "",
      });
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  addExtraRoom = async (req, res) => {
    const { event_id } = req.params;
    const form = new formidable.IncomingForm({ multiples: false });

    try {
      const { fields } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields) =>
          err ? reject(err) : resolve({ fields })
        );
      });

      const extraRoom = Number.parseInt(toStr(fields.extra_room));
      const eventId = Number.parseInt(event_id);

      // If this is a function in Oracle returning scalar, you can SELECT INTO, but simpler: wrap call in PL/SQL block
      const plsql = `BEGIN ADD_EXTRA_ROOM_TO_EVENT_RESERVATION(:event_id, :extra); END;`;
      await db.execute(
        plsql,
        { event_id: eventId, extra: extraRoom },
        { autoCommit: true }
      );

      return res.status(200).redirect(`/event-rooms/${eventId}`);
    } catch (error) {
      console.error("Error adding extra room:", error);
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };
}

module.exports = new DashboardController();
