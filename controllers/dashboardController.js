// controllers/DashboardController.js
const db = require("../config/db");
const formidable = require("formidable");
const oracledb = require("oracledb");

const toStr = (v) => (Array.isArray(v) ? String(v[0]) : String(v ?? ""));

class DashboardController {
  // -------------------------
  // Common / Dashboard
  // -------------------------
  dashboardPage = (req, res) => {
    const { userInfo } = req;
    res.status(200).render("dashboard/index.ejs", {
      title: "Dashboard",
      user: userInfo,
    });
  };

  // -------------------------
  // Admin: Hotels
  // -------------------------
  hotelPage = async (req, res) => {
    const { userInfo } = req;
    try {
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
      console.error("Error fetching hotels:", error);
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
    try {
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
    } catch (error) {
      console.error("Error fetching guests:", error);
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  // GET /update-guest?id=123
  updateGuestsPage = async (req, res) => {
    const { userInfo } = req;
    try {
      const id = Number(req.query.id); // form page is opened via query (?id=)
      if (!id) {
        return res.status(400).render("dashboard/error.ejs", {
          status: 400,
          title: "Error",
          message: "Missing guest id",
          error: new Error("Missing id"),
        });
      }

      const sql = `SELECT USER_ID, EMAIL, IMG_URL, USER_TYPE FROM USERS WHERE USER_ID = :id`;
      const { rows } = await db.execute(
        sql,
        { id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const userRow = rows?.[0];

      if (!userRow) {
        return res.status(404).render("dashboard/error.ejs", {
          status: 404,
          title: "Not Found",
          message: "Guest not found",
          error: new Error("Guest not found"),
        });
      }

      return res.status(200).render("dashboard/update-guests.ejs", {
        title: "Update Guest",
        user: userInfo,
        userRow,
        error: "",
      });
    } catch (error) {
      console.error("Error loading guest:", error);
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  // POST /update-guest  (id comes from hidden input OR query fallback)
  // POST /update-guest
  // POST /update-guest
  updateGuest = async (req, res) => {
    try {
      // ID comes from hidden input; fallback to ?id=
      const id = Number(req.body.user_id || req.query.id);
      if (!id) {
        return res.status(400).render("dashboard/error.ejs", {
          status: 400,
          title: "Error",
          message: "Missing guest id",
          error: new Error("Missing id"),
        });
      }

      const email = String(req.body.email || "").trim();
      const img_url = String(req.body.img_url || "").trim();
      const user_type_raw = String(req.body.user_type || "").trim();

      if (!email) {
        const { rows } = await db.execute(
          `SELECT USER_ID, EMAIL, IMG_URL, USER_TYPE FROM USERS WHERE USER_ID = :id`,
          { id },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.status(400).render("dashboard/update-guests.ejs", {
          title: "Update Guest",
          user: req.userInfo,
          userRow: rows?.[0] || {
            USER_ID: id,
            EMAIL: "",
            IMG_URL: "",
            USER_TYPE: "client",
          },
          error: "Email is required",
        });
      }

      const user_type = user_type_raw === "admin" ? "admin" : "client";

      await db.execute(
        `
      UPDATE USERS
         SET EMAIL = :email,
             IMG_URL = :img_url,
             USER_TYPE = :user_type
       WHERE USER_ID = :id
      `,
        { email, img_url: img_url || null, user_type, id },
        { autoCommit: true }
      );

      return res.redirect("/guests");
    } catch (error) {
      console.error("Error updating guest:", error);
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  addHotelPage = async (req, res) => {
    res.status(200).render("dashboard/add-hotel.ejs", {
      title: "Add Hotel",
      user: req.userInfo,
      error: "",
    });
  };

  addHotelRoomsPage = async (req, res) => {
    const { userInfo } = req;
    const { hotel_id } = req.params;
    try {
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
    } catch (error) {
      console.error("Error fetching hotel:", error);
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  // get_hotel_rooms returns SYS_REFCURSOR -> fetch via OUT bind
  hotelRoomsPage = async (req, res) => {
    const { userInfo } = req;
    const { hotel_id } = req.params;

    let conn;
    try {
      const pool = await db.getPool();
      conn = await pool.getConnection();

      const result = await conn.execute(
        `BEGIN :rc := get_hotel_rooms(:id); END;`,
        {
          id: Number(hotel_id),
          rc: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const rs = result.outBinds.rc;
      const rows = await rs.getRows(1000);
      await rs.close();

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
    } finally {
      if (conn) await conn.close();
    }
  };

  updateHotelRoomsPage = async (req, res) => {
    const { userInfo } = req;
    const { hotel_id } = req.params;

    let conn;
    try {
      const pool = await db.getPool();
      conn = await pool.getConnection();

      // Use your cursor function but expect UPPERCASE column names from Oracle
      const result = await conn.execute(
        `BEGIN :rc := get_hotel_rooms(:id); END;`,
        {
          id: Number(hotel_id),
          rc: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const rs = result.outBinds.rc;
      const rows = await rs.getRows(1000);
      await rs.close();

      // rows should have keys like ROOM_SIZE, TOTAL_ROOM, AVAILABLE_ROOM
      return res.status(200).render("dashboard/update-rooms.ejs", {
        title: "Update Rooms",
        user: userInfo,
        hotelId: Number(hotel_id),
        rooms: rows,
        error: "",
      });
    } catch (error) {
      console.error("Error fetching hotel rooms (update):", error);
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    } finally {
      if (conn) await conn.close();
    }
  };

  updateHotelRooms = async (req, res) => {
    const { hotel_id } = req.params;

    // helper: get a clean string out of formidable fields
    const pick = (obj, key) => {
      const v = obj[key];
      return Array.isArray(v) ? v[0] : v;
    };

    // helper: strict numeric parse
    const toNum = (v) => {
      const s = (v ?? "").toString().trim();
      if (s === "") return null; // treat empty as null (we'll error out below for required)
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    };

    const form = new formidable.IncomingForm({ multiples: false });

    try {
      const { fields } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields) =>
          err ? reject(err) : resolve({ fields })
        );
      });

      // Collect all sizes that were actually submitted: look for t_*_room / a_*_room
      // Example names from EJS: t_small_hall_room, a_small_hall_room, etc.
      const updates = []; // { size, total, available }

      Object.keys(fields).forEach((key) => {
        // total field?
        let m = key.match(/^t_(.+)_room$/i);
        if (m) {
          const size = m[1]; // e.g., "small_hall"
          const totalVal = toNum(pick(fields, key));
          // find matching available field
          const aKey = `a_${size}_room`;
          const availableVal = toNum(pick(fields, aKey));

          updates.push({ size, total: totalVal, available: availableVal });
        }
      });

      // Validate we got something
      if (updates.length === 0) {
        return res.status(400).render("dashboard/error.ejs", {
          status: 400,
          title: "Error",
          message: "No room data submitted.",
          error: new Error("No room fields"),
        });
      }

      // Validate numbers
      for (const u of updates) {
        if (u.total === null || u.available === null) {
          return res.status(400).render("dashboard/error.ejs", {
            status: 400,
            title: "Error",
            message: `Missing values for ${u.size.replace("_", " ")}.`,
            error: new Error("Missing numeric value"),
          });
        }
        if (Number.isNaN(u.total) || Number.isNaN(u.available)) {
          return res.status(400).render("dashboard/error.ejs", {
            status: 400,
            title: "Error",
            message: `Invalid number for ${u.size.replace("_", " ")}.`,
            error: new Error("NaN in inputs"),
          });
        }
        if (u.total < 0 || u.available < 0 || u.available > u.total) {
          return res.status(400).render("dashboard/error.ejs", {
            status: 400,
            title: "Error",
            message: `Invalid totals for ${u.size.replace(
              "_",
              " "
            )} (check >=0 and available <= total).`,
            error: new Error("Invalid totals"),
          });
        }
      }

      // Build one PL/SQL block that only updates the sizes provided
      // (prevents binding NaN or missing values)
      let plsql = "BEGIN\n";
      const binds = { hid: Number(hotel_id) };

      updates.forEach((u, idx) => {
        const i = idx + 1;
        plsql += `  update_hotel_room(:hid, :s${i}, :t${i}, :a${i});\n`;
        binds[`s${i}`] = u.size; // 'small_hall' | 'medium_hall' | 'large_hall'
        binds[`t${i}`] = u.total; // number
        binds[`a${i}`] = u.available; // number
      });
      plsql += "END;";

      await db.execute(plsql, binds, { autoCommit: true });

      return res.redirect(`/view-rooms/${Number(hotel_id)}`);
    } catch (error) {
      console.error("updateHotelRooms error:", error);
      return res.status(500).render("dashboard/error.ejs", {
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

      // unique by name
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

      await db.execute(
        `BEGIN create_hotel(:hotel_name, :address, :state, :zip_code, :website, :phone); END;`,
        { hotel_name, address, state, zip_code, website, phone },
        { autoCommit: true }
      );

      return res.status(200).redirect("/hotel");
    } catch (error) {
      console.error("registerHotel error:", error);
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

      await db.execute(
        `BEGIN create_hotel_room(:hotel_id, :t_s, :t_m, :t_l, :a_s, :a_m, :a_l); END;`,
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
      console.error("registerRoomsToHotel error:", error);
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  // -------------------------
  // Client: Events
  // -------------------------
  eventsPage = async (req, res) => {
    const { userInfo } = req;
    try {
      const sql = `SELECT * FROM EVENT_RESERVATION WHERE GUEST_ID = :id ORDER BY START_DATE DESC`;
      const { rows } = await db.execute(
        sql,
        { id: Number(userInfo.id ?? userInfo.USER_ID) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      res.status(200).render("dashboard/events.ejs", {
        title: "Events",
        user: userInfo,
        events: rows,
        error: rows.length ? "" : "No events reserved yet.",
      });
    } catch (error) {
      console.error("eventsPage error:", error);
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  // get_available_rooms_with_type returns SYS_REFCURSOR -> fetch via OUT bind
  // controllers/dashboardController.js (only this handler shown)

  reserveEventPage = async (req, res) => {
    const { userInfo } = req;

    try {
      // Event types
      const { rows: eventTypesData } = await db.execute(
        `SELECT EVENT_ID, EVENT_NAME FROM EVENT_TYPE`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // Hotels
      const { rows: hotelsData } = await db.execute(
        `SELECT HOTEL_ID, HOTEL_NAME FROM HOTEL`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // Rooms with name + availability
      const roomsSql = `
      SELECT
        ar.AVAILABLE_ROOM_ID,
        ar.HOTEL_ID,
        ar.ROOM_ID,
        rt.ROOM_SIZE       AS ROOM_TYPE_NAME,
        ar.AVAILABLE_ROOM  AS AVAILABLE_ROOM
      FROM AVAILABLE_ROOM_PER_HOTEL ar
      JOIN ROOM_TYPE rt
        ON rt.ROOM_ID = ar.ROOM_ID
      ORDER BY ar.HOTEL_ID, rt.ROOM_SIZE
    `;
      const { rows: roomsData } = await db.execute(
        roomsSql,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      res.status(200).render("dashboard/reserve-event.ejs", {
        title: "Reserve Event",
        user: userInfo,
        eventTypes: eventTypesData,
        hotels: hotelsData,
        rooms: roomsData,
        error: "",
      });
    } catch (error) {
      console.error("reserveEventPage error:", error);
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  // Call your INSERT_EVENT_RESERVATION (insert_event_reservation) with correct params
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
      const start_date = toStr(fields.start_date); // YYYY-MM-DD
      const end_date = toStr(fields.end_date);
      const room_quantity = Number.parseInt(toStr(fields.room_quantity));
      const no_of_people = Number.parseInt(toStr(fields.no_of_people));
      const userId = Number(req.userInfo?.id ?? req.userInfo?.USER_ID);

      // We’ll pass p_room_invoice as 0 for now; your procedure will update invoice later as needed
      await db.execute(
        `
        BEGIN
          insert_event_reservation(
            p_guest_id            => :p_guest_id,
            p_hotel_id            => :p_hotel_id,
            p_event_id            => :p_event_id,
            p_room_id             => :p_room_id,
            p_start_date          => TO_DATE(:p_start_date, 'YYYY-MM-DD'),
            p_end_date            => TO_DATE(:p_end_date,   'YYYY-MM-DD'),
            p_room_quantity       => :p_room_qty,
            p_room_invoice        => :p_room_invoice,
            p_date_of_reservation => SYSDATE,
            p_no_of_people        => :p_num_people,
            p_status              => :p_status
          );
        END;`,
        {
          p_guest_id: userId,
          p_hotel_id: hotel,
          p_event_id: event_type,
          p_room_id: room,
          p_start_date: start_date,
          p_end_date: end_date,
          p_room_qty: room_quantity,
          p_room_invoice: 0, // or compute if you want
          p_num_people: no_of_people,
          p_status: 1, // Reserved
        },
        { autoCommit: true }
      );

      return res.status(200).redirect("/events");
    } catch (error) {
      console.error("reserveEventRegister error:", error);
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  // POST /delete-guest
  // controllers/dashboardController.js (inside the class)
  deleteGuest = async (req, res) => {
    try {
      const id = Number(req.body.id || req.query.id);

      if (!id) {
        return res.status(400).render("dashboard/error.ejs", {
          status: 400,
          title: "Error",
          message: "Missing guest id",
          error: new Error("Missing id"),
        });
      }

      // Optional: block self-delete via UI
      if (req.userInfo && Number(req.userInfo.id) === id) {
        return res.status(400).render("dashboard/error.ejs", {
          status: 400,
          title: "Error",
          message: "You cannot delete your own account here.",
          error: new Error("Self-delete blocked"),
        });
      }

      // Optional: block deleting admins
      const check = await db.execute(
        `SELECT USER_TYPE FROM USERS WHERE USER_ID = :id`,
        { id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!check.rows?.length) {
        return res.status(404).render("dashboard/error.ejs", {
          status: 404,
          title: "Not Found",
          message: "User not found",
          error: new Error("User not found"),
        });
      }
      if (check.rows[0].USER_TYPE === "admin") {
        return res.status(403).render("dashboard/error.ejs", {
          status: 403,
          title: "Forbidden",
          message: "Cannot delete admin users.",
          error: new Error("Admin delete blocked"),
        });
      }

      // Cascade delete: SERVICE_RESERVATION -> EVENT_RESERVATION -> USERS
      const plsql = `
      BEGIN
        DELETE FROM SERVICE_RESERVATION
         WHERE EVENT_RESERVATION_ID IN (
           SELECT EVENT_RESERVATION_ID
             FROM EVENT_RESERVATION
            WHERE GUEST_ID = :id
         );

        DELETE FROM EVENT_RESERVATION
         WHERE GUEST_ID = :id;

        DELETE FROM USERS
         WHERE USER_ID = :id;
      END;`;

      await db.execute(plsql, { id }, { autoCommit: true });

      return res.redirect("/guests");
    } catch (error) {
      console.error("Error deleting guest:", error);
      // If something still bubbles up, show a friendly message
      const msg = (error && error.message) || "Internal server error";
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: msg,
        error,
      });
    }
  };

  // get_event_rooms returns SYS_REFCURSOR -> fetch via OUT bind
  eventRoomsPage = async (req, res) => {
    const { userInfo } = req;
    const { event_id } = req.params;

    let conn;
    try {
      const pool = await db.getPool();
      conn = await pool.getConnection();

      const result = await conn.execute(
        `BEGIN :rc := get_event_rooms(:id); END;`,
        {
          id: Number(event_id),
          rc: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const rs = result.outBinds.rc;
      const rows = await rs.getRows(1000);
      await rs.close();

      res.status(200).render("dashboard/event-rooms.ejs", {
        title: "Event Rooms",
        user: userInfo,
        eventId: event_id,
        rooms: rows,
      });
    } catch (error) {
      console.error("eventRoomsPage error:", error);
      res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    } finally {
      if (conn) await conn.close();
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
      console.error("addRoomsPage error:", error);
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

      await db.execute(
        `BEGIN add_extra_room_to_event_reservation(:event_id, :extra); END;`,
        { event_id: eventId, extra: extraRoom },
        { autoCommit: true }
      );

      return res.status(200).redirect(`/event-rooms/${eventId}`);
    } catch (error) {
      console.error("addExtraRoom error:", error);
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
