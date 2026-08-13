<?php

session_start(); // Starting Session
ini_set('display_errors', '0');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, x-requested-with');
//error_reporting(E_ALL ^ E_NOTICE);
require_once("../config/config.php");
include 'funcs.php';

$action = filter_input(INPUT_GET, 'action', FILTER_SANITIZE_NUMBER_INT);
$date = date('Y-m-d H:i:s');
$loggedUserId = $_SESSION['login_user'];

switch ($action) {

    default:
        header('Content-type:text/xml');
        echo '<?xml version="1.0"?>' . PHP_EOL;
        echo '<rows>';
        treeDir();
        echo '</rows>';
        break;

    case 1:

        header("Content-type:text/xml");
        print('<menu id="0" >');
        print('<item text="Add Root Item"  img="new.gif"  id="add_root"/>');
        print('<item text="Add Sub Item"  img="new.gif"  id="add_sub"/>');
        print('<item text="Change to root category"  img="new.gif"  id="change_to_root"/>');
        print('<item text="Delete Item"  img="deleteall.png"  id="delete"/>');
        print('</menu>');
        break;

    case 2:

        $insertRootItem = "INSERT INTO ntk_devices(`name`,`sort_id`) SELECT 'New',IF((MAX(sort_id)>0),MAX(sort_id)+1,1)sort_id FROM ntk_devices WHERE parent_id = 0";
        $insertRootItemResult = mysqli_query($conn, $insertRootItem) or die(mysqli_error($conn));

        if (!$insertRootItemResult) {
            $data['data'] = array('response' => $insertRootItemResult, 'text' => 'An Error Occured While Creating Device');
            echo json_encode($data);
            break;
        }

        $itemId = mysqli_insert_id($conn,);

        $insertPrivileges = "INSERT INTO user_management.program_user_privileges (program_id,item_id,user_id,`read_privilege`,`write_privilege`,`create_privilege`,`delete_privilege`,item_level) VALUES ('1'," . $itemId . "," . $loggedUserId . ",'1','1','1','1','1')";
        mysqli_query($conn, $insertPrivileges) or die(mysqli_error($conn));

        $insertTemplate = "INSERT INTO ntk_templates(`device_id`) VALUES ($itemId)";
        $insertTemplateResult = mysqli_query($conn, $insertTemplate) or die(mysqli_error($conn));

        if (!$insertTemplateResult) {
            $data['data'] = array('response' => $insertTemplateResult, 'text' => 'An Error Occured While Creating Template');
            echo json_encode($data);
            break;
        }

        $template_id = mysqli_insert_id($conn,);
        $insertTemplateFields = "INSERT INTO ntk_template_fields(`name`,`gridname`,`type`,`sort_id`,`templ_id`,`common`,`visible`,`viewer`) SELECT name,gridname,type,sort_id,'" . $template_id . "',common,visible,`viewer` FROM ntk_main_fields ORDER BY sort_id ASC";
        $insertTemplateFieldsResult = mysqli_query($conn, $insertTemplateFields) or die(mysqli_error($conn));

        if ($insertTemplateFieldsResult) {

            $data['data'] = array('response' => $insertTemplateFieldsResult, 'text' => 'An Error Occured While Creating Fields');
            echo json_encode($data);
            break;
        }

//        createTreeXML();
//        createDevicesGridXML($itemId);
//        clearstatcache();

        $data['data'] = array('response' => true, 'text' => 'Successfully Created', "newId" => $itemId);
        echo json_encode($data);

        break;

    case 3:

        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $kpi = filter_input(INPUT_GET, 'kpi', FILTER_VALIDATE_BOOLEAN);

        $insertSubItem = "INSERT INTO ntk_devices(`name`,`sort_id`,`parent_id`) SELECT 'New',IF((MAX(sort_id)>0),MAX(sort_id)+1,1)sort_id," . $id . " FROM ntk_devices WHERE parent_id = " . $id;

        $insertSubItemResult = mysqli_query($conn, $insertSubItem) or die(mysqli_error($conn));

        if (!$insertSubItemResult) {

            $data['data'] = array('response' => $insertSubItemResult, 'text' => 'An Error Occured While Saving');
            echo json_encode($data);
            break;
        }

        $menu_id = mysqli_insert_id($conn,);

        $insertTemplate = "INSERT INTO ntk_templates(`device_id`) VALUES ($menu_id)";
        $insertTemplateResult = mysqli_query($conn, $insertTemplate) or die(mysqli_error($conn));

        if (!$insertTemplateResult) {
            $data['data'] = array('response' => $insertTemplateResult, 'text' => 'An Error Occured While Saving');
            echo json_encode($data);
            break;
        }

        $template_id = mysqli_insert_id($conn,);

        if ($id == 538) {
//            createCommonTestFormFields($template_id);
        } else {
            createCommonTemplateFields($template_id);
        }

        if ($kpi) {

            mysqli_query($conn, "INSERT INTO kpi_main.kpi_table(`date`) VALUES(now())") or die(mysqli_error($conn));

            $kpiId = mysqli_insert_id($conn,);
            mysqli_query($conn, "INSERT INTO network_to_kpi(kpi_id,network_id) VALUES($kpiId,$menu_id)") or die(mysqli_error($conn));
        }

//        createTreeXML();
//        createDevicesGridXML($menu_id);
//        clearstatcache();

        $data['data'] = array('response' => true, 'text' => 'Successfully Created', "newId" => $menu_id);
        echo json_encode($data);

        break;

    case 4:

        $deviceId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

        $query = "
            SELECT 
              ntk_template_fields.`name`,
              ntk_device_records.id,
              ntk_template_fields.id field_id,
              ntk_template_fields.common,
              ntk_template_fields.index_field,
              ntk_template_fields.visible,
              ntk_template_fields.description,
              (
                CASE
                  WHEN ntk_template_fields.`name` = 'Description' 
                  AND ntk_template_fields.`common` = '1' 
                  THEN '' 
                  WHEN ntk_template_fields.`name` = 'Branch' 
                  AND ntk_template_fields.`common` = '1' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    Branch_Name 
                  FROM
                    nts_site.branch 
                  WHERE visible = 1 
                    AND Branch_ID = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`name` = 'Room' 
                  AND ntk_template_fields.`common` = '1' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    `name` 
                  FROM
                    `ntk_rooms` 
                  WHERE `id` = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`name` = 'Main category' 
                  AND ntk_template_fields.`common` = '0' 
                  AND ntk_template_fields.`templ_id` = '362' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    `name` 
                  FROM
                    `ntk_devices` 
                  WHERE `id` = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`name` = 'Sub category' 
                  AND ntk_template_fields.`common` = '0' 
                  AND ntk_template_fields.`templ_id` = '362' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    `name` 
                  FROM
                    `ntk_devices` 
                  WHERE `id` = (ntk_field_values.field_value)) 
                  ELSE ntk_field_values.field_value 
                END
              ) AS field_value 
            FROM
              ntk_templates 
              JOIN ntk_device_records 
                ON ntk_device_records.device_id = ntk_templates.device_id 
              JOIN ntk_field_values 
                ON ntk_field_values.device_id = ntk_device_records.id 
              JOIN ntk_template_fields 
                ON ntk_template_fields.id = ntk_field_values.field_id 
                AND ntk_template_fields.templ_id = ntk_templates.id 
            WHERE ntk_templates.device_id = $deviceId 
            ORDER BY ntk_device_records.id,
              ntk_template_fields.sort_id";
        
//        echo $query; exit;
        
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn).$query);

        $previousDeviceId = null;
        $firstIsDone = false;
        $headers = array();
        $devices = array();

        
        while ($row = mysqli_fetch_assoc($result)) {
            if ($previousDeviceId !== null && $row['id'] != $previousDeviceId && !$firstIsDone) {
                $firstIsDone = true;
            } elseif (!$firstIsDone) {
                
            }
            if ($row['visible'] == '1') {
                $devices[$row['id']][$row['name']] = $row['field_value'];
                if ($deviceId != 540 && $deviceId != 648 && $deviceId != 652 && $row['index_field'] == 1 && !empty($row['field_value'])) {
                    $devices[$row['id']][$row['name']] = '';

                    $query_desc = "
                        SELECT 
                          ntk_field_values.id,
                          ntk_template_fields.`name`,
                          ntk_field_values.`device_id`,
                          (
                            CASE
                              WHEN ntk_template_fields.`name` = 'Description' 
                              AND ntk_template_fields.`common` = '1' 
                              THEN '' 
                              WHEN ntk_template_fields.`name` = 'Branch' 
                              AND ntk_template_fields.`common` = '1' 
                              AND ntk_field_values.field_value > 0 
                              THEN 
                              (SELECT 
                                Branch_Name 
                              FROM
                                nts_site.branch 
                              WHERE visible = 1 
                                AND Branch_ID = (ntk_field_values.field_value)) 
                              WHEN ntk_template_fields.`name` = 'Room' 
                              AND ntk_template_fields.`common` = '1' 
                              AND ntk_field_values.field_value > 0 
                              THEN 
                              (SELECT 
                                `name` 
                              FROM
                                `ntk_rooms` 
                              WHERE `id` = (ntk_field_values.field_value)) 
                              ELSE ntk_field_values.field_value 
                            END
                          ) AS field_value 
                        FROM
                          ntk_field_values 
                          JOIN ntk_template_fields 
                            ON ntk_field_values.field_id = ntk_template_fields.id 
                        WHERE device_id IN ({$row['field_value']}) 
                          AND ntk_template_fields.`description` = 1 
                        ORDER BY ntk_template_fields.sort_id ASC";
                    
                    
                    


                    $desc = mysqli_query($conn, $query_desc) or die($query_desc);
                    
                                        
                    while ($row_desc = mysqli_fetch_assoc($desc)) {
                        $fullDesc[$row_desc['device_id']][] = $row_desc['field_value'];
                    }
                    
                    
                    $description = '';
                    foreach ($fullDesc as $id1 => $columns1) {

                        foreach ($columns1 as $val1) {
                            $description .= $val1 . " ";
                        }
                        $description .= ",";
                    }
                    $description = substr($description, 0, strlen($description) - 1);
                    $devices[$row['id']][$row['name']] .= $description;
                    unset($fullDesc);
                    
                    
                }
                

                $previousDeviceId = $row['id'];
            }
            
                           

            if ($row['description'] == '1') {
                $devices[$row['id']]['Description'] .= " " . $row['field_value'];
            }
        }
        
// echo $query; exit;
        
        
        $sel_header = mysqli_query($conn,
                        "SELECT
                        ntk_template_fields.id,
                        ntk_template_fields.`type`,
                        ntk_template_fields.`name`,
                        ntk_template_fields.`gridname`
                   FROM
                        ntk_template_fields
                JOIN ntk_templates ON ntk_template_fields.templ_id = ntk_templates.id
                AND visible = 1
                AND ntk_templates.device_id = " . $deviceId . "
                ORDER BY
                        sort_id ASC"
                ) or die(mysqli_error($conn));

        while ($row_header = mysqli_fetch_assoc($sel_header)) {

            $obj = new stdClass;
            $obj->id = $row_header['id'];
            $obj->name = $row_header['name'];
            $obj->gridname = $row_header['gridname'];
            $obj->type = $row_header['type'];
            $headers[$obj->id] = $obj;
        }
        
        

        header('Content-type:text/xml;charset=UTF-8;');
        echo '<?xml version = "1.0"?>' . PHP_EOL;
        echo '<rows>';
        echo '<head>';
        echo '<column id="counter" type="cntr" align="left" sort="int">Counter</column>';
        echo '<column id="id" type="ro" align="left" sort="str">ID</column>';

        $filters = '#numeric_filter,#numeric_filter';
        foreach ($headers as $fieldId => $fieldNames) {
            $filters .= ',#text_filter';
            if ($headers[$fieldId]->type == 'checkbox') {
                echo '<column id="' . $fieldId . '" type="ch" align="center" sort="str">' . $headers[$fieldId]->gridname . '</column>';
            } else {
                echo '<column id="' . $fieldId . '" type="ro" align="left" sort="str">' . $headers[$fieldId]->gridname . '</column>';
            }
        }
        echo '<afterInit>';
        echo '<call command="attachHeader">';
        echo '<param>' . $filters . '</param>';
        echo '</call>';
        echo '</afterInit>';

        echo '</head>';

        foreach ($devices as $id => $columns) {
            echo '<row id="' . $id . '">';
            echo '<cell></cell>';
            echo '<cell>' . $id . '</cell>';
            foreach ($headers as $val => $value) {
                echo "<cell><![CDATA[" . $columns[$headers[$val]->name] . "]]></cell>";
            }
            echo '</row>';
        }

        echo '</rows>';
        break;

    case 5:
        header("Content-type:text/xml");
        print("<?xml version = \"1.0\"?>");

        echo "<rows>";
        $resQry = mysqli_query($conn, "SELECT a.id,b.name FROM ntk_templates a LEFT JOIN ntk_devices b ON a.device_id = b.id") or die(mysqli_error($conn));
        while ($rowQry = mysqli_fetch_assoc($resQry)) {
            echo "<row id = '" . $rowQry["id"] . "'>";
            echo "<cell> {$rowQry["id"]} </cell>";
            echo "<cell><![CDATA[" . $rowQry["name"] . "]]></cell>";
            echo "</row>";
        }
        echo "</rows>";
        break;

    case 6;
        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        header('Content-type:text/xml');
        echo '<?xml version="1.0"?>' . PHP_EOL;
        echo '<rows>';
        templateFieldsGridXML($id);
        echo '</rows>';

        break;

    case 7:


        $index = $_GET["index"];
        $fieldvalue = $_GET["fieldvalue"];
        $id = $_GET["id"];
        $field = $_GET["colId"];
        $colType = $_GET["colType"];
        $fieldvalue = mysqli_real_escape_string($conn, $fieldvalue);

        $updateResult = updateSQL("ntk_devices", $field, $fieldvalue, $id, "id", $colType);
        if ($updateResult) {

//            createTreeXML();
//            clearstatcache();
            $data['data'] = array('response' => $updateResult, 'text' => 'Successfully Saved');
        } else {
            $data['data'] = array('response' => $updateResult, 'text' => 'An Error Occured While Saving');
        }

        echo json_encode($data);

        break;

    case 8:
        header("Content-type:text/xml");
        print("<?xml version = \"1.0\"?>");

        echo "<rows>";
        $resQry = mysqli_query($conn, "SELECT a.id,b.name FROM ntk_templates a LEFT JOIN ntk_devices b ON a.device_id = b.id WHERE b.id =" . $_GET['id']) or die(mysqli_error($conn));
        while ($rowQry = mysqli_fetch_assoc($resQry)) {
            echo "<row id = '" . $rowQry["id"] . "'>";
            echo "<cell> {$rowQry["id"]} </cell>";
            echo "<cell><![CDATA[" . $rowQry["name"] . "]]></cell>";
            echo "</row>";
        }
        echo "</rows>";
        break;

    case 9:

        $index = $_POST["index"];
        $fieldvalue = filter_input(INPUT_POST, 'fieldvalue');
        $id = filter_input(INPUT_POST, 'id');
        $field = filter_input(INPUT_POST, 'colId');
        $colType = filter_input(INPUT_POST, 'colType');
        $catId = filter_input(INPUT_POST, 'cat_id');
        $gridname = filter_input(INPUT_POST, "gridname", FILTER_SANITIZE_NUMBER_INT);

        if ($colType != "int") {
            $fieldvalue = mysqli_real_escape_string($conn, $fieldvalue);
        }

//        $privilege = mysql_result(mysqli_query($conn, "SELECT
//                            priviledges.write_privilege
//                    FROM
//                            user_management.program_user_privileges priviledges
//                    WHERE
//                            priviledges.program_id = 1
//                    AND priviledges.item_level > 0
//                    AND priviledges.user_id = " . $loggedUserId . "
//                    AND priviledges.item_id = " . $catId), 0, 0);
//
//        if ($privilege === '1') {

        $updateResult = updateSQL("ntk_template_fields", $field, $fieldvalue, $id, "id", $colType);
        if ($updateResult) {
            if ($field === 'name' && $gridname) {
                updateSQL("ntk_template_fields", 'gridname', $fieldvalue, $id, "id", $colType);
            }
            if ($field === 'gridname' && $gridname) {
                updateSQL("ntk_template_fields", 'name', $fieldvalue, $id, "id", $colType);
            }
//            createDevicesGridXML($catId);
//            devicesGridUpdateXML($catId);
//            clearstatcache();
            $data['data'] = array('response' => $updateResult, 'text' => 'Successfully Updated');
        } else {
            $data['data'] = array('response' => $updateResult, 'text' => 'An Error Occured While Saving');
        }
//        } else {
//            $data['data'] = array('response' => false, 'text' => 'You Dont Have Permissions to Edit This Field');
//        }
        echo json_encode($data);

        break;

    case 10:

        $fieldvalue = $_POST["nValue"];
        $id = $_POST["id"];
        $field = $_POST["colId"];
        $catId = $_POST["catId"];

//        $privilege = mysql_result(mysqli_query($conn, "SELECT
//                            priviledges.write_privilege
//                    FROM
//                            user_management.program_user_privileges priviledges
//                    WHERE
//                            priviledges.program_id = 1
//                    AND priviledges.item_level > 0
//                    AND priviledges.user_id = " . $loggedUserId . "
//                    AND priviledges.item_id = " . $catId), 0, 0);
//
//        if ($privilege === '1') {

        $updateResult = updateSQL("ntk_template_fields", $field, $fieldvalue, $id, "id", $colType);
        if ($updateResult) {
//            createDevicesGridXML($catId);
//            devicesGridUpdateXML($catId);
//            clearstatcache();
            $data['data'] = array('response' => $updateResult, 'text' => 'Successfully Updated');
        } else {
            $data['data'] = array('response' => $updateResult, 'text' => 'An Error Occured While Saving');
        }
//        } else {
//            $data['data'] = array('response' => false, 'text' => 'You Dont Have Permissions to Edit This Field');
//        }
        echo json_encode($data);

        break;

    case 11:

        $templateId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

        $id = filter_input(INPUT_GET, 'cat_id', FILTER_SANITIZE_NUMBER_INT);

//        $privilege = mysql_result(mysqli_query($conn, "SELECT
//                            priviledges.create_privilege
//                    FROM
//                            user_management.program_user_privileges priviledges
//                    WHERE
//                            priviledges.program_id = 1
//                    AND priviledges.item_level > 0
//                    AND priviledges.user_id = " . $loggedUserId . "
//                    AND priviledges.item_id = " . $id), 0, 0);
//
//        if ($privilege === '1') {

        $insertTemplateField = "INSERT INTO ntk_template_fields(`sort_id`,`templ_id`) SELECT IF(ISNULL(MAX(sort_id)),1,max(sort_id)+1) as mx,'" . $templateId . "' FROM ntk_template_fields WHERE templ_id = " . $templateId . " AND parent_id = 0";

        $result = mysqli_query($conn, $insertTemplateField) or die(mysqli_error($conn));

        if ($result) {
            $fieldId = mysqli_insert_id($conn,);
//            createDevicesGridXML($id);
//            devicesGridUpdateXML($id);
//            clearstatcache();
            $data['data'] = array('success' => $result, 'id' => $fieldId, 'text' => 'Successfully Saved');
        } else {
            $data['data'] = array('success' => $result, 'text' => 'An Error Occured While Saving');
        }
//        } else {
//            $data['data'] = array('success' => false, 'text' => 'You Dont Have Permissions to Create New Field');
//        }

        echo json_encode($data);

        break;

    case 12:


        $rowId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $id = filter_input(INPUT_GET, 'cat_id', FILTER_SANITIZE_NUMBER_INT);
// Get details of selected record.
        $sql = "SELECT * FROM ntk_template_fields WHERE id = " . $rowId;
        $result = mysqli_query($conn, $sql) or die(mysqli_error($conn));
        $row = mysqli_fetch_assoc($result);
        $sortorder = $row['sort_id'];
        $templ_id = $row['templ_id'];
        $parent = $row['parent_id'];

        $delete = "DELETE FROM ntk_template_fields WHERE id = " . $rowId;
        $deleteResult = mysqli_query($conn, $delete) or die(mysqli_error($conn));
        if ($deleteResult) {
            if ($sortorder > 1) {
                // Update remaining records.
                $sql = "UPDATE ntk_template_fields SET sort_id = sort_id-1 WHERE templ_id = " . $templ_id . " AND parent_id=" . $parent . " AND sort_id > $sortorder ";
                $updated = mysqli_query($conn, $sql) or die(mysqli_error($conn));
            }
//            createDevicesGridXML($id);
//            devicesGridUpdateXML($id);
//            clearstatcache();
            $data['data'] = array('response' => $deleteResult, 'text' => 'Successfully Deleted');
        } else {
            $data['data'] = array('response' => $deleteResult, 'text' => 'An Error Occured While Deleting');
        }
        echo json_encode($data);
        break;

    case 13:
        $sql_sort_max = "SELECT max(sort_id) as mx FROM ntk_fields_options WHERE field_id = '" . $_GET['id'] . "'";
        $res_mx = mysqli_query($conn, $sql_sort_max) or die(mysqli_error($conn));
        $row_mx = mysqli_fetch_assoc($res_mx);
        $sort = $row_mx['mx'];
        $sort++;

        $QRY_INSERT_TEMPLATE_FIELDS = "INSERT INTO ntk_fields_options(`name`,`sort_id`,`field_id`) VALUES ('','{$sort}','" . $_GET['id'] . "')";
        $RESULT = mysqli_query($conn, $QRY_INSERT_TEMPLATE_FIELDS);
        if ($RESULT) {
            $id = mysqli_insert_id($conn,);
            $data['data'] = array('success' => $RESULT, 'id' => $id);
        } else
            $data['data'] = array('success' => $RESULT);

        echo json_encode($data);

        break;

    case 14:

        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

        header("Content-type:text/xml");
        print("<?xml version = \"1.0\"?>");
        echo "<rows>";
        optionsTreeDir($id);
        echo "</rows>";
        break;

    case 15:

        $ids = json_decode(filter_input(INPUT_POST, 'id'));

        $sql = "SELECT * FROM ntk_fields_options WHERE id IN (" . implode(",", $ids) . ")";
        $result = mysqli_query($conn, $sql) or die(mysqli_error($conn));

        while ($row = mysqli_fetch_assoc($result)) {
            $sortorder = $row['sort_id'];
            $field_id = $row['field_id'];
            $parent_id = $row['parent_id'];

            $delete = "DELETE FROM ntk_fields_options WHERE id = " . $row['id'];
            $deleteResult = mysqli_query($conn, $delete) or die(mysqli_error($conn));
            if ($deleteResult) {
                if ($sortorder > 1) {
                    // Update remaining records.
                    $sql = "UPDATE ntk_fields_options SET sort_id = sort_id-1 WHERE field_id = " . $field_id . " AND parent_id= $parent_id AND sort_id > $sortorder ";
                    $updated = mysqli_query($conn, $sql) or die(mysqli_error($conn));
                }
            }
        }
        echo json_encode(array("response" => 'Deleted'));

        break;

    case 16:

        $fieldvalue = filter_input(INPUT_POST, 'fieldvalue');
        $id = filter_input(INPUT_POST, 'id');
        $field = filter_input(INPUT_POST, 'colId');
        $colType = filter_input(INPUT_POST, 'colType');
        $fieldvalue = mysqli_real_escape_string($conn, $fieldvalue);

        $updateResult = updateSQL("ntk_fields_options", $field, $fieldvalue, $id, "id", $colType);
        if ($updateResult) {
            $data['data'] = array('response' => $updateResult, 'text' => 'Successfully Updated');
        } else {
            $data['data'] = array('response' => $updateResult, 'text' => 'An Error Occured While Saving');
        }

        echo json_encode($data);

        break;

    case 17:

        $fieldvalue = $_POST["nValue"];
        $id = $_POST["id"];
        $field = $_POST["colId"];

        $updateResult = updateSQL("ntk_fields_options", $field, $fieldvalue, $id, "id", "int");
        if ($updateResult) {
            $data['data'] = array('response' => $updateResult, 'text' => 'Successfully Updated');
        } else {
            $data['data'] = array('response' => $updateResult, 'text' => 'An Error Occured While Saving');
        }
        echo json_encode($data);

        break;

    case 18:
        $rowcount = mysqli_num_rows(mysqli_query($conn, "SELECT id FROM ntk_devices WHERE parent_id = {$_GET['id']}"));
        echo json_encode(array("hasChildren" => $rowcount));
        break;

    case 19:

        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

//        $privilege = mysql_result(mysqli_query($conn, "SELECT
//                            priviledges.delete_privilege
//                    FROM
//                            user_management.program_user_privileges priviledges
//                    WHERE
//                            priviledges.program_id = 1
//                    AND priviledges.item_level > 0
//                    AND priviledges.user_id = '" . $loggedUserId . "'
//                    AND priviledges.item_id = " . $id), 0, 0);
//
//        if ($privilege === '1') {

        $delete = "DELETE FROM ntk_devices WHERE id = " . $id;
        $deleteResult = mysqli_query($conn, $delete) or die(mysqli_error($conn));
        if ($deleteResult) {
//            createTreeXML();
            $data['data'] = array('response' => $deleteResult, 'text' => 'Successfully Deleted');
        } else {
            $data['data'] = array('response' => $deleteResult, 'text' => 'An Error Occured While Deleted');
        }
//        } else {
//            $data['data'] = array('response' => false, 'text' => 'You Dont Have Permissions to Delete This Category');
//        }
        echo json_encode($data);
        break;

    case 20:

        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $record_id = filter_input(INPUT_GET, 'record_id', FILTER_SANITIZE_NUMBER_INT);

        $query = "SELECT * FROM ntk_devices ORDER BY parent_id = 0 DESC,id";
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));

        $deviceObjects = array();
        $deviceCategory = array();
        $deviceSubCategory = array();

        while ($row = mysqli_fetch_assoc($result)) {

            if (!isset($deviceObjects[$row['id']])) {
                $deviceObjects[$row['id']] = new stdClass;
            }

            $obj = $deviceObjects[$row['id']];
            $obj->id = $row['id'];
            $obj->name = $row['name'];

            if ($row['parent_id'] == 0) {
                $deviceCategory[] = $obj;
            } else {
                $deviceSubCategory[] = $obj;
            }
        }

        $query = "
            SELECT
                    ntk_fields_options.*
            FROM
                    ntk_fields_options
            JOIN ntk_template_fields ON ntk_template_fields.id = ntk_fields_options.field_id
            JOIN ntk_templates ON ntk_templates.id = ntk_template_fields.templ_id
            WHERE
                    ntk_templates.device_id = " . $id . "
            ORDER BY
                    ntk_fields_options.field_id,
                    ntk_fields_options.sort_id";

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $options = array();
        while ($row = mysqli_fetch_assoc($result)) {
            $options[$row['field_id']][$row['id']] = $row['name'];
        }

        $query = "SELECT t.id,t.`name` FROM ntk_main_fields_options t JOIN ntk_main_fields m on m.id = t.field_id WHERE m.sort_id = 5 ORDER BY t.sort_id ASC";

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $status_options = array();
        while ($row = mysqli_fetch_assoc($result)) {
            $status_options[$row['id']] = $row['name'];
        }

        $query = "SELECT Branch_ID id, Branch_Name `name` FROM nts_site.branch WHERE visible = 1 and Branch_ID > 0 ORDER BY Branch_ID ASC";

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $branch_options = array();
        while ($row = mysqli_fetch_assoc($result)) {
            $branch_options[$row['id']] = $row['name'];
        }

        $query = "SELECT ProjectID,ProjectName FROM greenhouse.project";
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $project_options = array();
        while ($row = mysqli_fetch_assoc($result)) {
            $project_options[$row['ProjectID']] = $row['ProjectName'];
        }

//templateFieldsFormXML($id, $record_id);
        header("Content-type:text/xml;charset=UTF-8;");
        print('<?xml version="1.0"?>');
        echo "<items>";
        templateFieldsFormXML($id, $record_id);
        echo "</items>";

        break;

    case 21:
        $resQry = mysqli_query($conn, "SELECT * FROM ntk_templates WHERE device_id = " . $_GET['id']) or die(mysqli_error($conn));
        $rowQry = mysqli_fetch_assoc($resQry);
        if ($rowQry["id"]) {

            $selTemplFields = mysqli_query($conn, "SELECT * FROM ntk_template_fields WHERE templ_id = " . $rowQry["id"] . " ORDER BY sort_id ASC") or die(mysqli_error($conn));
            while ($resTemplFields = mysqli_fetch_assoc($selTemplFields)) {

                $QRY_INSERT_FIELD_VALUE = "INSERT INTO ntk_field_values(`device_id`,`templ_id`,`field_id`) VALUES('{$_GET['id']}','{$rowQry["id"]}','{$resTemplFields['id']}')";
                mysqli_query($conn, $QRY_INSERT_FIELD_VALUE) or die(mysqli_error($conn) . $QRY_INSERT_FIELD_VALUE);
            }
        }
        break;

    case 22:
        $deviceId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $active = filter_input(INPUT_GET, 'active', FILTER_SANITIZE_NUMBER_INT);

        $query = " 
            SELECT 
              ntk_template_fields.`name`,
              ntk_device_records.id,
              ntk_template_fields.id field_id,
              ntk_template_fields.`type` field_type,
              ntk_template_fields.`name` field_name,
              ntk_template_fields.common,
              ntk_template_fields.index_field,
              ntk_template_fields.visible,
              ntk_template_fields.description,
              (
                CASE
                  WHEN ntk_template_fields.`name` = 'Description' 
                  AND ntk_template_fields.`common` = '1' 
                  THEN 
                  (SELECT 
                    GROUP_CONCAT(
                      COALESCE(
                        CASE
                          WHEN ntk_template_fields.`name` = 'Description' 
                          AND ntk_template_fields.`common` = '1' 
                          THEN '' 
                          WHEN ntk_template_fields.`name` = 'Branch' 
                          AND ntk_template_fields.`common` = '1' 
                          AND ntk_field_values.field_value > 0 
                          THEN 
                          (SELECT 
                            Branch_Name 
                          FROM
                            nts_site.branch 
                          WHERE visible = 1 
                            AND Branch_ID = (ntk_field_values.field_value)) 
                          WHEN ntk_template_fields.`name` = 'Room' 
                          AND ntk_template_fields.`common` = '1' 
                          AND ntk_field_values.field_value > 0 
                          THEN 
                          (SELECT 
                            `name` 
                          FROM
                            `ntk_rooms` 
                          WHERE `id` = (ntk_field_values.field_value)) 
                          ELSE ntk_field_values.field_value 
                        END,
                        ''
                      ) 
                      ORDER BY ntk_template_fields.sort_id ASC SEPARATOR ' '
                    ) device_field_value 
                  FROM
                    ntk_field_values 
                    JOIN ntk_template_fields 
                      ON ntk_field_values.field_id = ntk_template_fields.id 
                  WHERE device_id = ntk_device_records.id 
                    AND ntk_template_fields.description = 1) 
                  WHEN ntk_template_fields.`name` = 'Branch' 
                  AND ntk_template_fields.`common` = '1' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    Branch_Name 
                  FROM
                    nts_site.branch 
                  WHERE visible = 1 
                    AND Branch_ID = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`name` = 'Room' 
                  AND ntk_template_fields.`common` = '1' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    `name` 
                  FROM
                    `ntk_rooms` 
                  WHERE `id` = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`name` = 'Main category' 
                  AND ntk_template_fields.`common` = '0' 
                  AND ntk_template_fields.`templ_id` = '362' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    `name` 
                  FROM
                    `ntk_devices` 
                  WHERE `id` = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`name` = 'Sub category' 
                  AND ntk_template_fields.`common` = '0' 
                  AND ntk_template_fields.`templ_id` = '362' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    `name` 
                  FROM
                    `ntk_devices` 
                  WHERE `id` = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`index_field` = 1 
                  THEN 
                  (SELECT 
                    GROUP_CONCAT(
                      COALESCE(a.field_value, '') 
                      ORDER BY b.sort_id ASC SEPARATOR ' '
                    ) 
                  FROM
                    ntk_field_values a 
                    JOIN ntk_template_fields b 
                      ON a.field_id = b.id 
                  WHERE a.device_id = ntk_field_values.field_value 
                    AND b.description = 1) 
                  WHEN ntk_template_fields.`name` = 'User' 
                  AND ntk_field_values.field_value = '' 
                  THEN 'General' 
                  ELSE ntk_field_values.field_value 
                END
              ) AS field_value 
            FROM
              ntk_device_records 
              JOIN ntk_templates 
                ON ntk_templates.device_id = ntk_device_records.device_id 
              JOIN ntk_field_values 
                ON ntk_device_records.id = ntk_field_values.device_id 
              JOIN ntk_template_fields 
                ON ntk_field_values.field_id = ntk_template_fields.id 
                AND ntk_template_fields.templ_id = ntk_templates.id 
                AND ntk_template_fields.visible = 1 ";

        if ($active > 0) {
            $query .= " 
                JOIN 
                    (SELECT 
                      ntk_field_values.device_id 
                    FROM
                      ntk_field_values 
                      JOIN ntk_template_fields 
                        ON ntk_template_fields.id = ntk_field_values.field_id 
                        AND ntk_template_fields.templ_id = 
                        (SELECT 
                          id 
                        FROM
                          ntk_templates 
                        WHERE device_id = " . $deviceId . " ) 
                        AND ntk_template_fields.`name` = 'status' 
                    WHERE REPLACE(
                        ntk_field_values.field_value,
                        ' ',
                        ''
                      ) = 'inuse') activeDevices 
                    ON ntk_device_records.id = activeDevices.device_id ";
        }

        $query .= " 
            WHERE
                ntk_templates.device_id = " . $deviceId . "
            ORDER BY
                ntk_device_records.id,
                ntk_template_fields.sort_id";

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));

        $previousDeviceId = null;
        $firstIsDone = false;
        $headers = array();
        $devices = array();
        while ($row = mysqli_fetch_assoc($result)) {
            if ($previousDeviceId !== null && $row['id'] != $previousDeviceId && !$firstIsDone) {
                $firstIsDone = true;
            } elseif (!$firstIsDone) {
                
            }

            $devices[$row['id']][$row['name']] = $row['field_value'];

            $obj = new stdClass;
            $obj->id = $row['field_id'];
            $obj->name = $row['field_name'];
            $obj->type = $row['field_type'];
            $headers[$obj->id] = $obj;
        }

        header('Content-type:text/xml');
        echo '<?xml version = "1.0"?>' . PHP_EOL;
        echo '<rows>';

        foreach ($devices as $id => $columns) {
            echo '<row id="' . $id . '">';
            echo '<cell></cell>';
            echo '<cell>' . $id . '</cell>';
            foreach ($headers as $val => $value) {
                echo "<cell><![CDATA[" . $columns[$headers[$val]->name] . "]]></cell>";
            }
            echo '</row>';
        }
        echo '</rows>';
        break;

    case 23:

        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

        $insertDeviceRecord = "INSERT INTO ntk_device_records(`device_id`) VALUES('" . $id . "')";
        if (mysqli_query($conn, $insertDeviceRecord)) {
            $row_id = mysqli_insert_id($conn,);

            $query = "
                SELECT 
                  ntk_template_fields.id field_id,
                  ntk_templates.id template_id,
                  ntk_fields_options.`name` field_value 
                FROM
                  ntk_template_fields 
                  LEFT JOIN ntk_templates 
                    ON ntk_template_fields.templ_id = ntk_templates.id 
                  LEFT JOIN ntk_fields_options 
                    ON ntk_fields_options.field_id = ntk_template_fields.id 
                    AND ntk_fields_options.default_value = 1 
                WHERE ntk_templates.device_id = " . $id . " 
                ORDER BY ntk_template_fields.sort_id ASC";

            $result = mysqli_query($conn, $query) or die(mysqli_error($conn));

            $insert = array();
            while ($row = mysqli_fetch_assoc($result)) {

                $field_id = $row['field_id'];
                $template_id = $row['template_id'];
                $field_value = $row['field_value'];

                $insert[] = "(" . $field_id . ", " . $template_id . ", " . $row_id . ", '" . mysqli_real_escape_string($conn, $field_value) . "')";
            }

            if (count($insert) > 0) {
                $query = "INSERT INTO ntk_field_values(`field_id`,`templ_id`,`device_id`,`field_value`) VALUES " . implode(',', $insert) . " ON DUPLICATE KEY UPDATE field_value=VALUES(field_value)";
                $insertResult = mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);
                if ($insertResult) {
//                    createDevicesGridXML($id);
//                    devicesGridUpdateXML($id);
//                    clearstatcache();
                    $data['data'] = array('response' => $insertResult, 'text' => 'Successfully Added', "newId" => $row_id);
                } else {
                    $data['data'] = array('response' => $insertResult, 'text' => 'An Error Occured');
                }
            } else {
                $data['data'] = array('response' => false, 'text' => 'An Error Occured');
            }
        } else {
            $data['data'] = array('response' => false, 'text' => 'An Error Occured');
        }

        echo json_encode($data);

        break;

    case 24:



        $cat_id = filter_input(INPUT_GET, 'cat_id', FILTER_SANITIZE_NUMBER_INT);
        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $templ_id = filter_input(INPUT_GET, 'templ_id', FILTER_SANITIZE_NUMBER_INT);

//        $privilege = mysql_result(mysqli_query($conn, "SELECT
//                            priviledges.write_privilege
//                    FROM
//                            user_management.program_user_privileges priviledges
//                    WHERE
//                            priviledges.program_id = 1
//                    AND priviledges.item_level > 0
//                    AND priviledges.user_id = " . $loggedUserId . "
//                    AND priviledges.item_id = " . $id), 0, 0);
//
//        if ($privilege === '1') {

        $insert = array();
        $fields = array();
        $nodes = array();

        $projectId = 0;
        $unrealAssetId = 0;
        $assetPatternId = 0;
        $x = '';
        $y = '';
        $z = '';

        foreach ($_POST as $key => $value) {
            $fieldName = explode("_", $key);
            $fieldId = $fieldName[1];
            if ($fieldName[0] !== 'combo' && $fieldId > 0) {
                $fields[] = $fieldId;
            }
        }
        $fieldList = implode(',', $fields);

        $description_array = array();

//                print '<pre>';
//        print_r($_POST);
//        exit;

        $query = "SELECT * FROM `ntk_template_fields` WHERE id IN(" . $fieldList . ")";
//        echo $query;exit;
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);
        while ($row = mysqli_fetch_assoc($result)) {
            $obj = new stdClass;
            $obj->id = $row['id'];
            $obj->name = $row['name'];
            $obj->common = $row['common'];
            $obj->index_field = $row['index_field'];
            $obj->index_id = $row['index_id'];
            $obj->type = $row['type'];
            $obj->description = $row['description'];
            $nodes[$obj->id] = $obj;
        }

        $roomId = 'null';

        foreach ($_POST as $key => $value) {

            $fieldName = explode("_", $key);
            $fieldId = $fieldName[1];

            if ($nodes[$fieldId]->name == 'Room' && $nodes[$fieldId]->common > 0) {
                $roomId = $value;
            }
        }

        if (empty($roomId)) {
            $roomId = 'null';
        }

        foreach ($_POST as $key => $value) {


            $fieldName = explode("_", $key);
            $fieldId = $fieldName[1];

            if ($nodes[$fieldId]->type == 'password' || $nodes[$fieldId]->type == 'Password') {
                require 'std.encryption.class.php';
                $crypt = new encryption_class;
                $password = $value;

                $crypt->setAdjustment($adj);
                $crypt->setModulus($mod);

                $adj = $crypt->getAdjustment();
                $mod = $crypt->getModulus();
                $encrypt_result = &$_SESSION['encrypt_result'];
                $decrypt_result = &$_SESSION['decrypt_result'];
                $errors = array();

                $encrypt_password = $crypt->encrypt('1234', $password, $pswdlen);
                $decrypt_result = $crypt->decrypt('1234', $encrypt_result);
                $value = $encrypt_password;
            } else {
                $value = mysqli_real_escape_string($conn, $value);
            }

            if ($nodes[$fieldId]->description > 0) {
                $description_array[$fieldId] = array('field' => $fieldId, 'index_field' => $nodes[$fieldId]->index_field, 'index_id' => $nodes[$fieldId]->index_id, 'field_value' => $value);
            }

            if ($nodes[$fieldId]->type == 'document' && $value) {

                if (!is_numeric($value)) {

                    $value_array = explode(' | ', $value);
                    $value = $value_array[0];
                }

                $insertDoc = "INSERT INTO ntk_device_to_document (`device_id`,`document_id`,`field_id`, `templ_id`) VALUES (" . $id . "," . $value . "," . $fieldId . "," . $templ_id . ") ON DUPLICATE KEY UPDATE document_id=VALUES(document_id)";
                mysqli_query($conn, $insertDoc) or die(mysqli_error($conn) . $insertDoc);
            }


            if ($nodes[$fieldId]->name == 'Unreal AssetID' && $nodes[$fieldId]->common > 0 && $value > 0) {
                $unrealAssetId = $value;
            }

            if ($nodes[$fieldId]->type == 'project_id' && $value > 0) {
                $projectId = $value;
            }

            if (!($nodes[$fieldId]->name == 'Description' && $nodes[$fieldId]->common == '1')) {
                if ($nodes[$fieldId]->index_field == 1 && $nodes[$fieldId]->index_id > 0) {
                    
                } else {
                    if ($fieldName[0] !== 'combo' && $fieldId > 0) {
                        $insert[] = "(" . $id . "," . $templ_id . "," . $fieldId . "," . $roomId . ",'" . $value . "',NOW())";
                    }
                }
            }

            if ($nodes[$fieldId]->name == 'X-pos' && $nodes[$fieldId]->common > 0) {
                $x = $value;
            }

            if ($nodes[$fieldId]->name == 'Y-pos' && $nodes[$fieldId]->common > 0) {
                $y = $value;
            }

            if ($nodes[$fieldId]->name == 'Z-pos' && $nodes[$fieldId]->common > 0) {
                if ($value > 0) {
                    $z = $value;
                } else {
                    $z = '0.0';
                }
            }

            if ($nodes[$fieldId]->name == 'Angle' && $nodes[$fieldId]->common > 0) {
                if ($value > 0) {
                    $angle = $value;
                } else {
                    $angle = '0.0';
                }
            }
        }



//print_r($insert);
        if (count($insert) > 0) {

            $query = "INSERT INTO ntk_field_values(`device_id`,`templ_id`,`field_id`,`room_id`,`field_value`,`last_changed`) VALUES " . implode(',', $insert) . " ON DUPLICATE KEY UPDATE field_value=VALUES(field_value),last_changed=VALUES(last_changed),room_id=VALUES(room_id)";

//            print_r($query); exit;

            $updateResult = mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);

            if ($updateResult) {

//                if ($templ_id == '5') {
//
//                    if ($_POST['form_6358'] == '' || !isset($_POST['form_6358'])) {
//
//                        $query = "SELECT
//                                    MAX(field_value) field_value
//                            FROM
//                                    ntk_field_values
//                            WHERE
//                                    field_id = '6358'
//                            AND templ_id = '5'
//                            AND device_id IN(
//                                    SELECT
//                                            device_id
//                                    FROM
//                                            ntk_field_values
//                                    WHERE
//                                            field_id = '31'
//                                    AND field_value = '" . $_POST['form_31'] . "'
//                                    AND templ_id = '5'
//                            )";
//
//                        $result = mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);
//                        $row = mysqli_fetch_assoc($result);
//                        $count = $row['field_value'];
//
//                        $l = -3;
//                        $count = generateCounter($count, $l);
//                        ++$count;
//
//                        if (strlen($count) == 1) {
//                            $no = "PC-" . $_POST['form_31'] . "00" . $count;
//                        } else if (strlen($count) == 2) {
//                            $no = "PC-" . $_POST['form_31'] . "0" . $count;
//                        } else if (strlen($count) == 3) {
//                            $no = "PC-" . $_POST['form_31'] . $count;
//                        }
//                        $update = "UPDATE ntk_field_values SET field_value='" . $no . "' WHERE field_id = 6358 AND templ_id = 5 AND device_id = " . $id;
//                        $updateResult = mysqli_query($conn, $update) or die(mysqli_error($conn));
//                    }
//                }


                if ($unrealAssetId > 0 && $projectId > 0) {

                    //generate asset pattern description
                    $final_description = '';
                    foreach ($description_array as $key => $value) {

                        if ($value['index_field'] > 0 && $value['index_id']) {
                            $description = explode(']', $value['field_value']);
                            $final_description .= " " . $description[1] . ",";
                        } else {
                            $final_description .= " " . $value['field_value'] . ",";
                        }
                    }

                    if ($final_description) {
                        $final_description = substr($final_description, 0, strlen($final_description) - 1);
                        $final_description = substr($final_description, 1, strlen($final_description));
                    }

                    //connect db_asset to unreal_asset
                    $insertAsset = "INSERT INTO greenhouse.dbasset_to_unrealasset(`dbAssetID`,`unrealAssetID`) VALUES (" . $id . "," . $unrealAssetId . ") ON DUPLICATE KEY UPDATE unrealAssetID=VALUES(unrealAssetID)";
                    mysqli_query($conn, $insertAsset) or die(mysqli_error($conn) . $insertAsset);

                    $query = "SELECT assetid_to_assetpattern.PatternID,staticmeshs.X_Size,staticmeshs.Y_Size FROM greenhouse.assetid_to_assetpattern JOIN greenhouse.design_pattern ON design_pattern.PatternID = assetid_to_assetpattern.PatternID JOIN greenhouse.staticmeshs ON staticmeshs.AssetID = design_pattern.AssetID WHERE assetid_to_assetpattern.dbAssetID = " . $id;
                    $result = mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);
                    $row_count = mysqli_num_rows($result);

                    $SpawnRotation = "P=0.0, R=0.0, Y=$angle, S=0";
                    if ($row_count > 0) {

                        //update asset pattern for the db asset
                        $row = mysqli_fetch_assoc($result);
                        $assetPatternId = $row['PatternID'];
                        $XSize = $row['X_Size'];
                        $YSize = $row['Y_Size'];

                        $XUnreal = $x + (0.5 * $XSize);
                        $YUnreal = $y + (0.5 * $YSize);
                        $SpawnPosition = "X=$XUnreal,Y=$YUnreal,Z=$z";

                        $update_desc = "UPDATE greenhouse.design_pattern SET Description='" . $final_description . "',X_SmartDraw='" . $x . "',Y_SmartDraw='" . $y . "',SpawnPosition='" . $SpawnPosition . "',SpawnRotation='" . $SpawnRotation . "' WHERE PatternID = " . $assetPatternId;
                        mysqli_query($conn, $update_desc) or die(mysqli_error($conn));
                    } else {

                        $query = "SELECT staticmeshs.X_Size,staticmeshs.Y_Size FROM greenhouse.staticmeshs WHERE AssetID =" . $unrealAssetId;
                        $result = mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);
                        $row = mysqli_fetch_assoc($result);
                        $XSize = $row['X_Size'];
                        $YSize = $row['Y_Size'];

                        $XUnreal = $x + (0.5 * $XSize);
                        $YUnreal = $y + (0.5 * $YSize);
                        $SpawnPosition = "X=$XUnreal,Y=$YUnreal,Z=$z";

                        //create asset pattern for the db asset
                        $insertPattern = "INSERT INTO greenhouse.design_pattern SET AssetID = " . $unrealAssetId . ",ProjectID=" . $projectId . ",X_SmartDraw='" . $x . "',Y_SmartDraw='" . $y . "',Description='" . $final_description . "',SpawnPosition='" . $SpawnPosition . "',SpawnRotation='" . $SpawnRotation . "'";
                        $resultPattern = mysqli_query($conn, $insertPattern) or die(mysqli_error($conn) . $insertPattern);

                        if ($resultPattern) {
                            $assetPatternId = mysqli_insert_id($conn,);

                            $update = "INSERT INTO greenhouse.assetid_to_assetpattern (`dbAssetID`,`PatternID`) VALUES (" . $id . "," . $assetPatternId . ") ON DUPLICATE KEY UPDATE PatternID=VALUES(PatternID)";
                            $updateResult = mysqli_query($conn, $update) or die(mysqli_error($conn) . $update);
                        }
                    }
                }

//                createDevicesGridXML($cat_id);
//                devicesGridUpdateXML($cat_id);
//                clearstatcache();
                $data['data'] = array('success' => $updateResult, 'text' => 'Successfully Added');
            } else {
                $data['data'] = array('success' => $updateResult, 'text' => 'An Error Occured');
            }
        }


//        } else {
//            $data['data'] = array('success' => false, 'text' => 'You Dont Have Permissions to Update This Record');
//        }

        echo json_encode($data);
        break;

    case 25:

        $record_id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $template_id = filter_input(INPUT_GET, 'templ_id', FILTER_SANITIZE_NUMBER_INT);

        $query = "
            SELECT 
                ntk_field_values.device_id,
                ntk_field_values.field_value,
                ntk_template_fields.id field_id,
                ntk_template_fields.`name` field_name,
                ntk_template_fields.type field_type,
                ntk_template_fields.index_field,
                ntk_template_fields.index_id,
                ntk_template_fields.common 
            FROM
                ntk_template_fields
                LEFT JOIN ntk_field_values                  
                  ON ntk_field_values.field_id = ntk_template_fields.id AND ntk_field_values.`device_id` = " . $record_id . " 
            WHERE ntk_template_fields.`templ_id` = " . $template_id;

//        echo $query; exit;

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $xml_str = '';

        while ($row = mysqli_fetch_assoc($result)) {
            $value = $row['field_value'];

            if ($row['field_type'] == 'password') {

                $a1 = $value;

                require 'std.encryption.class.php';
                $crypt = new encryption_class;

                $crypt->setAdjustment($adj);
                $crypt->setModulus($mod);

                $adj = $crypt->getAdjustment();
                $mod = $crypt->getModulus();
                $d1 = $crypt->decrypt('1234', $a1);

                $value = $d1; //echo $a1; exit; 
            }

            if ($row['field_name'] == 'Description' && $row['common'] == '1') {

                $get_desc = "
                      SELECT 
                        ntk_field_values.id,
                        ntk_template_fields.`name`,
                        ntk_field_values.`device_id`,
                        (
                          CASE
                            WHEN ntk_template_fields.`name` = 'Description' 
                            AND ntk_template_fields.`common` = '1' 
                            THEN '' 
                            WHEN ntk_template_fields.`name` = 'Branch' 
                            AND ntk_template_fields.`common` = '1' 
                            AND ntk_field_values.field_value > 0 
                            THEN 
                            (SELECT 
                              Branch_Name 
                            FROM
                              nts_site.branch 
                            WHERE visible = 1 
                              AND Branch_ID = (ntk_field_values.field_value)) 
                            WHEN ntk_template_fields.`name` = 'Room' 
                            AND ntk_template_fields.`common` = '1' 
                            AND ntk_field_values.field_value > 0 
                            THEN 
                            (SELECT 
                              `name` 
                            FROM
                              `ntk_rooms` 
                            WHERE `id` = (ntk_field_values.field_value)) 
                            ELSE ntk_field_values.field_value 
                          END
                        ) AS field_value 
                      FROM
                        ntk_field_values 
                        JOIN ntk_template_fields 
                          ON ntk_field_values.field_id = ntk_template_fields.id 
                      WHERE device_id = '" . $record_id . "' 
                        AND ntk_template_fields.`description` = 1 
                      ORDER BY ntk_template_fields.sort_id ASC";

                $desc = mysqli_query($conn, $get_desc) or die(mysqli_error($conn));
                $description = '';
                while ($row_desc = mysqli_fetch_assoc($desc)) {
                    $description .= " " . $row_desc['field_value'];
                }
                $description = substr($description, 1, strlen($description));
                $value = $description;
            }

            if ($row['index_field'] == 1 && !empty($row['field_value'])) {

                $fullDesc = array();
                $get_desc = "SELECT 
                    ntk_field_values.id,
                    ntk_template_fields.`name`,
                    ntk_field_values.`device_id`,
                    (
                      CASE
                        WHEN ntk_template_fields.`name` = 'Description' 
                        AND ntk_template_fields.`common` = '1' 
                        THEN '' 
                        WHEN ntk_template_fields.`name` = 'Branch' 
                        AND ntk_template_fields.`common` = '1' 
                        AND ntk_field_values.field_value > 0 
                        THEN 
                        (SELECT 
                          Branch_Name 
                        FROM
                          nts_site.branch 
                        WHERE visible = 1 
                          AND Branch_ID = (ntk_field_values.field_value)) 
                        WHEN ntk_template_fields.`name` = 'Room' 
                        AND ntk_template_fields.`common` = '1' 
                        AND ntk_field_values.field_value > 0 
                        THEN 
                        (SELECT 
                          `name` 
                        FROM
                          `ntk_rooms` 
                        WHERE `id` = (ntk_field_values.field_value)) 
                        ELSE ntk_field_values.field_value 
                      END
                    ) AS field_value 
                  FROM
                    ntk_field_values 
                    JOIN ntk_template_fields 
                      ON ntk_field_values.field_id = ntk_template_fields.id 
                  WHERE device_id IN (" . $value . ") 
                    AND ntk_template_fields.`description` = 1 
                  ORDER BY ntk_template_fields.sort_id ASC ";

                $desc = mysqli_query($conn, $get_desc) or die(mysqli_error($conn));
                while ($row_desc = mysqli_fetch_assoc($desc)) {
                    $fullDesc[$row_desc['device_id']][] = $row_desc['field_value'];
                }
                $description = '';
                foreach ($fullDesc as $id => $columns) {
                    $description .= '[' . $id . ']';
                    foreach ($columns as $val) {
                        $description .= $val . " ";
                    }
                    $description = substr($description, 0, strlen($description) - 1);
                    $description .= ",";
                }
                $description = substr($description, 0, strlen($description) - 1);
                $value = $description;
                unset($fullDesc);
            }

            if ($row['field_type'] == 'document' && $value > 0) {

                $result = mysqli_query($conn, "SELECT Report_Subject FROM nts_site.tradestar_reports WHERE Report_ID = " . $value);
                $row = mysqli_fetch_assoc($result);
                $doc_subject = $row['Report_Subject'];

                $value .= ' | ' . $doc_subject;
            }

            if ($row['field_type'] === 'menu' || $row['field_type'] === 'menu_multi') {
                $fieldname = 'menu_' . $row['field_id'];
            } else {
                $fieldname = 'form_' . $row['field_id'];
            }

            $xml_str .= "<{$fieldname}><![CDATA[" . $value . "]]></{$fieldname}>";
        }

        header("Content-type:text/xml");
        print('<?xml version="1.0" encoding="utf-8"?>');
        echo "<data>";
        echo $xml_str;
        echo "</data>";
        break;

    case 26:
        $filer = "#numeric_filter";
        header("Content-type:text/xml");
        print("<?xml version = \"1.0\"?>");
        echo "<rows>";
        echo "<head>";
        echo ("<column id='id' type='ro' align='left' sort='str'>ID</column>");
        $selTemplFields = mysqli_query($conn, "SELECT * FROM ntk_main_fields WHERE visible = 1 ORDER BY sort_id ASC") or die(mysqli_error($conn));
        while ($resTemplFields = mysqli_fetch_assoc($selTemplFields)) {
            echo ("<column id='" . $resTemplFields['id'] . "' type='ro' align='left' sort='str'><![CDATA[" . $resTemplFields['gridname'] . "]]></column>");
            $filer .= ",#text_filter";
        }
//$filer = substr($filer, 0, strlen($filer) - 1);
        echo "<afterInit><call command='attachHeader'> <param>" . $filer . "</param></call></afterInit>";
        echo "</head>";

        echo "</rows>";
        break;

    case 27:

        /*
          $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
          // Get details of selected record.
          $sql = "SELECT * FROM category WHERE id = " . $id;
          $result = mysqli_query($dbc, $sql);
          $row = mysqli_fetch_assoc($result);
          $sortorder = $row['sort'];

          $delete = "DELETE FROM category WHERE id = " . $id;
          $deleteResult = mysqli_query($dbc, $delete);
          if ($deleteResult) {
          if ($sortorder > 1) {
          // Update remaining records.
          $sql = "UPDATE category SET sort = sort-1 WHERE sort > $sortorder";
          $updated = @mysqli_query($dbc, $sql);
          }
          $data['data'] = array('response' => $deleteResult, 'text' => 'Successfully Deleted');
          } else {
          $data['data'] = array('response' => $deleteResult, 'text' => 'An Error Occured While Deleting');
          }

          $query = "UPDATE ntk_template_fields SET sort_id = 3 WHERE sort_id = 3-1 AND templ_id = 522";
         */
        $templateId = filter_input(INPUT_POST, 'templ_id', FILTER_SANITIZE_NUMBER_INT);
        $parentId = filter_input(INPUT_POST, 'parent_id', FILTER_SANITIZE_NUMBER_INT);
        $itemid = filter_input(INPUT_POST, 'itemId', FILTER_SANITIZE_NUMBER_INT);
        $sortid = filter_input(INPUT_POST, 'sortId', FILTER_SANITIZE_NUMBER_INT);
        $direction = filter_input(INPUT_POST, 'direction');

        $itemidfield = 'id';
        $sortfield = 'sort_id';
        $table = 'ntk_template_fields';

        if ($direction == "up") {

            $sql = "SELECT MIN({$sortfield}) AS minmax FROM {$table} WHERE templ_id = {$templateId} AND parent_id = {$parentId} AND {$sortfield} > 0";
            $res = mysqli_query($conn, $sql) or die(mysqli_error($conn) . " " . $sql);
            $row = mysqli_fetch_array($res);
            $minmax = $row['minmax'];

            if ($sortid > $minmax) {
                $xsql = "UPDATE {$table} SET {$sortfield} = {$sortid} WHERE templ_id = {$templateId} AND parent_id = {$parentId} AND {$sortfield} = {$sortid}-1";
                $xres = mysqli_query($conn, $xsql) or die(mysqli_error($conn) . " " . $xsql);

                $sql = "UPDATE {$table} SET {$sortfield} = {$sortid}-1 WHERE {$itemidfield} = {$itemid}";
                $res = mysqli_query($conn, $sql) or die(mysqli_error($conn) . " " . $sql);
            }
        } else if ($direction == "down") {

            $sql = "SELECT MAX({$sortfield}) AS minmax FROM {$table} WHERE templ_id = {$templateId} AND parent_id = {$parentId} AND {$sortfield} > 0";
            $res = mysqli_query($conn, $sql) or die(mysqli_error($conn) . " " . $sql);
            $row = mysqli_fetch_array($res);
            $minmax = $row['minmax'];

            if ($sortid < $minmax) {

                $xsql = "UPDATE {$table} SET {$sortfield} = {$sortid} WHERE templ_id = {$templateId} AND parent_id = {$parentId} AND {$sortfield} = {$sortid}+1";
                $xres = mysqli_query($conn, $xsql) or die(mysqli_error($conn) . " " . $xsql);

                $sql = "UPDATE {$table} SET {$sortfield} = {$sortid}+1 WHERE {$itemidfield} = {$itemid}";
                $res = mysqli_query($conn, $sql) or die(mysqli_error($conn) . " " . $sql);
            }
        }

        $data['data'] = array('success' => true, 'message' => 'Successfully Updated');

        echo json_encode($data);

        break;

    case 28:

        $parentid = $_GET['field_id'];
        $parentfield = 'field_id';
        $itemid = $_GET['itemId'];
        $itemidfield = 'id';
        $sortid = $_GET['sortId'];
        $sortfield = 'sort_id';
        $table = 'ntk_fields_options';
        $direction = $_GET['direction'];

        echo json_encode(moveItemUpDownGrid($parentid, $parentfield, $itemid, $itemidfield, $sortid, $sortfield, $table, $direction));
        break;

    case 29:

        $id = filter_input(INPUT_GET, 'cat_id', FILTER_SANITIZE_NUMBER_INT);

//        $privilege = mysql_result(mysqli_query($conn, "SELECT
//                            priviledges.delete_privilege
//                    FROM
//                            user_management.program_user_privileges priviledges
//                    WHERE
//                            priviledges.program_id = 1
//                    AND priviledges.item_level > 0
//                    AND priviledges.user_id = " . $loggedUserId . "
//                    AND priviledges.item_id = " . $id), 0, 0);
//
//        if ($privilege === '1') {

        $SQL = "DELETE FROM ntk_device_records WHERE id = " . filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $res = mysqli_query($conn, $SQL) or die(mysqli_error($conn));
        if ($res) {
//            createDevicesGridXML($id);
//            devicesGridUpdateXML($id);
//            clearstatcache();
            $delValues = "DELETE FROM ntk_field_values WHERE device_id = " . filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
            $resValues = mysqli_query($conn, $delValues) or die(mysqli_error($conn));
            if ($resValues) {
                $data['data'] = array('response' => $resValues, 'text' => 'Successfully Deleted');
            } else {
                $data['data'] = array('response' => $resValues, 'text' => 'An error occured');
            }
        } else {
            $data['data'] = array('response' => $res, 'text' => 'An error occured');
        }
//        } else {
//            $data['data'] = array('response' => false, 'text' => 'You Dont Have Permissions to Delete This Record');
//        }
        echo json_encode($data);

        break;

    case 30:
        $parent = $_GET['parent'];
        if ($parent == 'undefined') {
            $parent = '0';
        }
        $SQL = "UPDATE ntk_devices SET parent_id = '{$parent}' WHERE id = {$_GET['id']}";
        if (mysqli_query($conn, $SQL)) {
//            createTreeXML();
//            clearstatcache();
            $msg = "Successfully saved!";
        } else {
            $msg = "Error : " . mysqli_error($conn);
        }
        echo json_encode(array("response" => $msg));
        break;

    case 31:
//        $fieldName = explode("_", $_GET['name']);
//        $field_id = $fieldName[1];
        $field_id = $_GET['id'];
        $selProcedure = mysqli_query($conn, "SELECT field_procedure FROM ntk_templates WHERE id = '{$field_id}'") or die(mysqli_error($conn));
        $row = mysqli_fetch_assoc($selProcedure);
        echo json_encode(array("content" => $row["field_procedure"]));
        break;

    case 32:
//        $fieldName = explode("_", $_POST['id']);
//        $field_id = $fieldName[1];
        $field_id = $_POST['id'];
        $content = $_POST["procedure"];
//$content = mysqli_real_escape_string($conn, $_POST["procedure"]);
        $SQL = "UPDATE ntk_templates SET field_procedure = '{$content}' WHERE id = {$field_id}";
        if (mysqli_query($conn, $SQL)) {
            $msg = "Successfully saved!";
        } else {
            $msg = "Error : " . mysqli_error($conn);
        }
        echo json_encode(array("message" => $msg));
        break;

    case 33:
        header("Content-type:text/xml");
        print('<?xml version="1.0" encoding="utf-8"?>');
        echo "<data>";
        $resTemplValues = mysqli_query($conn, "SELECT * FROM `ntk_field_values` WHERE `device_id` =" . $_GET['id']) or die(mysqli_error($conn));
        while ($rowTemplValues = mysqli_fetch_assoc($resTemplValues)) {
            $value = $rowTemplValues['field_value'];
            $selField = "SELECT * FROM `ntk_template_fields` WHERE id =" . $rowTemplValues['field_id'];
            $resField = mysqli_query($conn, $selField) or die(mysqli_error($conn));
            $rowField = mysqli_fetch_assoc($resField);
            if ($rowField['type'] == 'password') {

                $a1 = $value;

                require 'std.encryption.class.php';
                $crypt = new encryption_class;

                $crypt->setAdjustment($adj);
                $crypt->setModulus($mod);

                $adj = $crypt->getAdjustment();
                $mod = $crypt->getModulus();
                $d1 = $crypt->decrypt('1234', $a1);

                $value = $d1; //echo $a1; exit; 
            }
            $fieldname = 'form_' . $rowTemplValues['field_id'];
            echo "<{$fieldname}>{$value}</{$fieldname}>";
        }
        echo "</data>";
        break;
    case 34:
        $key = '1234';
        $a1 = "*x~qc";
        require 'std.encryption.class.php';
        $crypt = new encryption_class;

        $crypt->setAdjustment($adj);
        $crypt->setModulus($mod);
        $errors = array();
        $adj = $crypt->getAdjustment();
        $mod = $crypt->getModulus();
        $d1 = $crypt->decrypt($key, $a1);
        echo $d1;
//print_r($errors);

        break;
    case 35:
        header("Content-type:text/xml");
        print('<?xml version="1.0" encoding="UTF-8"?>');
        echo "<items>";

        $resQry = mysqli_query($conn, "SELECT * FROM ntk_templates WHERE device_id = " . $_GET['id']) or die(mysqli_error($conn));
        $rowQry = mysqli_fetch_assoc($resQry);
        if ($rowQry["id"]) {
            echo '<item type="settings" position="label-left"  labelWidth="90" inputWidth="230" offsetTop="5" offsetLeft="10"/>';

            $query = "SELECT * FROM ntk_template_fields WHERE templ_id = " . $rowQry["id"] . " AND common = 1 AND visible_in_form = 1 ORDER BY sort_id ASC";
            $selTemplFields = mysqli_query($conn,) or die(mysqli_error($conn));
            while ($resTemplFields = mysqli_fetch_assoc($selTemplFields)) {
                $type = $resTemplFields['type'];
                $indexField = $resTemplFields['index_field'];
                $indexId = $resTemplFields['index_id'];
                $info = false;
                $readonly = false;
                $style = '';
                $rows = '';
                $className = 'formbox';
                if (!$type || $type == 'password' || $type == 'crm' || $type == 'document') {
                    $type = 'input';
                }
                if ($type == 'multiline') {
                    $type = 'input';
                    if ($resTemplFields['value'] <= 10) {
                        $rows = 'rows="' . $resTemplFields['value'] . '"';
                    } else {
                        $rows = 'rows="10"';
                    }
                }
                if ($resTemplFields['name'] == 'Date In' || $resTemplFields['name'] == 'Date Out') {
                    $type = 'calendar';
                }
                if ($indexId > 0) {

                    if ($indexField > 0) {
                        $readonly = true;
                        $style = 'background-color:#e6e6e6;';
                    }
                    $info = true;
                    //$className = 'formbox_readonly';
                    //$type = 'multiselect';
                }
                if ($resTemplFields['name'] == 'Description') {
                    $readonly = true;
                    $style = 'background-color:#e6e6e6;';
                    //$className = 'formbox_readonly';
                }
                if ($type != 'tinymce') {
                    echo ("<item type='" . $type . "' inputWidth='" . $resTemplFields['width'] . "' name='form_" . $resTemplFields['id'] . "' $rows label='" . $resTemplFields['name'] . "' info='" . $info . "' readonly ='" . $readonly . "' className='" . $className . "' style='" . $style . "'>");

                    if ($resTemplFields['name'] == 'Status') {
                        $statusQuery = "SELECT t.id,t.name opt_name FROM ntk_main_fields_options t JOIN ntk_main_fields m on m.id = t.field_id WHERE m.sort_id = 5 ORDER BY t.sort_id ASC";
                        $statusResult = mysqli_query($conn, $statusQuery);
                        while ($rowstatus = mysqli_fetch_array($statusResult)) {
                            $status_name = $rowstatus["opt_name"];
                            echo("<option text='" . $status_name . "' value='" . $status_name . "'/>");
                        }
                    }
                    if ($resTemplFields['name'] == 'Branch') {
                        $branchQuery = "SELECT Branch_ID, Branch_Name FROM nts_site.branch WHERE visible = 1 and Branch_ID > 0 ORDER BY Branch_ID ASC";
                        $branchResult = mysqli_query($conn, $branchQuery);
                        while ($rows = mysqli_fetch_array($branchResult)) {
                            $this_branch_id = $rows["Branch_ID"];
                            $branch_name = $rows["Branch_Name"];
                            echo("<option text='" . $branch_name . "' value='" . $this_branch_id . "'/>");
                        }
                    }
                    /*
                      if ($resTemplFields['name'] == 'Office') {
                      $query = "SELECT * From ntk_rooms WHERE branch_id = 1 ORDER BY parent_id=0 DESC, sort_id";

                      $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
                      $devices = array();
                      while ($row = mysqli_fetch_assoc($result)) {
                      $obj = new stdClass();
                      $obj->name = $row['name'];
                      $obj->parent = $row['parent_id'];
                      $obj->id = $row['id'];
                      $devices[$row['id']] = $obj;
                      }
                      //print_r($devices);exit();
                      $newdevice;
                      foreach ($devices as $device) {
                      if ($device->parent > 0) {
                      $newdevice[$device->id] = $device;
                      $newdevice[$device->id]->newname = $devices[$device->parent]->name . "-" . $device->name;
                      }
                      }
                      foreach ($newdevice as $columns) {
                      echo("<option text='" . $columns->newname . "' value='" . $columns->id . "'/>");
                      }
                      }

                      if ($indexField && $indexId) {
                      $query = "
                      SELECT
                      ntk_template_fields.`name`,
                      ntk_device_records.id,
                      ntk_field_values.field_value
                      FROM
                      ntk_device_records
                      JOIN ntk_templates ON ntk_templates.device_id = ntk_device_records.device_id
                      JOIN ntk_field_values ON ntk_device_records.id = ntk_field_values.device_id
                      JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
                      AND ntk_template_fields.templ_id = ntk_templates.id
                      JOIN(
                      SELECT
                      device_id
                      FROM
                      ntk_field_values
                      WHERE
                      field_value IN('In Use', 'Planned')
                      )activeDevices ON ntk_device_records.id = activeDevices.device_id
                      WHERE
                      ntk_templates.device_id IN(
                      SELECT
                      ntk_devices.id device_id
                      FROM
                      ntk_templates
                      JOIN ntk_devices ON ntk_templates.device_id = ntk_devices.id
                      AND ntk_templates.id = {$indexId}
                      )
                      AND ntk_template_fields.`description` = 1
                      ORDER BY
                      ntk_device_records.id,
                      ntk_template_fields.sort_id";

                      $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
                      $devices = array();
                      while ($row = mysqli_fetch_assoc($result)) {
                      $devices[$row['id']][] = $row['field_value'];
                      }
                      echo('<option text="" value=""/>');
                      foreach ($devices as $id => $columns) {
                      $value = '';
                      foreach ($columns as $val) {
                      $value .= $val . " ";
                      }
                      echo('<option text="[' . $id . '] ' . $value . '" value="' . $id . '"/>');
                      }
                      }
                     */
                    echo ("</item>");
                }
            }

            echo ("<item type='newcolumn'  offset='20'/>");
            $query1 = "SELECT * FROM ntk_template_fields WHERE templ_id = " . $rowQry["id"] . " AND common = 0 AND visible_in_form = 1 ORDER BY sort_id ASC";
            $selTemplFields1 = mysqli_query($conn, query1) or die(mysqli_error($conn) . query1);
            $numberOfFields = mysqli_num_rows($selTemplFields1);

            $cntr = 1;
            if ($numberOfFields > 0) {
                while ($resTemplFields1 = mysqli_fetch_assoc($selTemplFields1)) {
                    $type = $resTemplFields1['type'];
                    $indexField = $resTemplFields1['index_field'];
                    $indexId = $resTemplFields1['index_id'];
                    $info = false;
                    $readonly = false;
                    $style = '';
                    $rows = '';
                    $className = 'formbox';
                    if (!$type || $type == 'password' || $type == 'crm' || $type == 'document') {
                        $type = 'input';
                    }
                    if ($type == 'multiline') {
                        $type = 'input';
                        if ($resTemplFields1['value'] <= 10) {
                            $rows = 'rows="' . $resTemplFields1['value'] . '"';
                        } else {
                            $rows = 'rows="10"';
                        }
                    }

                    $selTemplOptions = mysqli_query($conn, "SELECT * FROM ntk_fields_options WHERE field_id = " . $resTemplFields1['id'] . " AND visible_in_form = 1") or die(mysqli_error($conn));
                    if ((mysqli_num_rows($selTemplOptions)) && $indexField == 0) {
                        $type = 'combo';
                    }
                    if ($indexField > 0 && $indexField > 0) {
                        $info = true;
                        $readonly = true;
                        $style = 'background-color:#e6e6e6;';
                        //$className = 'formbox_readonly';
                        //$type = 'multiselect';
                    }
                    echo ("<item type='" . $type . "' inputWidth='" . $resTemplFields1['width'] . "' name='form_" . $resTemplFields1['id'] . "' $rows label='" . $resTemplFields1['name'] . "' info='" . $info . "' readonly ='" . $readonly . "' className='" . $className . "' style='" . $style . "'>");
                    while ($resTemplOptions = mysqli_fetch_assoc($selTemplOptions)) {
                        echo("<option text='" . $resTemplOptions['name'] . "' value='" . $resTemplOptions['name'] . "'/>");
                    }
                    /*
                      if ($indexField && $indexId) {
                      $query = "
                      SELECT
                      ntk_template_fields.`name`,
                      ntk_device_records.id,
                      ntk_field_values.field_value
                      FROM
                      ntk_device_records
                      JOIN ntk_templates ON ntk_templates.device_id = ntk_device_records.device_id
                      JOIN ntk_field_values ON ntk_device_records.id = ntk_field_values.device_id
                      JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
                      AND ntk_template_fields.templ_id = ntk_templates.id
                      JOIN(
                      SELECT
                      device_id
                      FROM
                      ntk_field_values
                      WHERE
                      field_value IN('In Use', 'Planned')
                      )activeDevices ON ntk_device_records.id = activeDevices.device_id
                      WHERE
                      ntk_templates.device_id IN(
                      SELECT
                      ntk_devices.id device_id
                      FROM
                      ntk_templates
                      JOIN ntk_devices ON ntk_templates.device_id = ntk_devices.id
                      AND ntk_templates.id = {$indexId}
                      )
                      AND ntk_template_fields.`description` = 1
                      ORDER BY
                      ntk_device_records.id,
                      ntk_template_fields.sort_id";

                      $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
                      $devices = array();
                      while ($row = mysqli_fetch_assoc($result)) {
                      $devices[$row['id']][] = $row['field_value'];
                      }
                      echo('<option text="" value=""/>');
                      foreach ($devices as $id => $columns) {
                      $value = '';
                      foreach ($columns as $val) {
                      $value .= $val . " ";
                      }
                      echo('<option text="[' . $id . '] ' . $value . '" value="' . $id . '"/>');
                      }
                      }
                     */
                    echo "</item>";
                    if ($numberOfFields > 10 && (round($numberOfFields / 2) == $cntr)) {
                        echo ("<item type='newcolumn'  offset='20'/>");
                    }
                    ++$cntr;
                }
            }
        }
        echo "</items>";
        break;

    case 36:
        header("Content-type:text/xml");
        print('<?xml version="1.0" encoding="utf-8"?>');
        echo "<data>";
        $resTemplValues = mysqli_query($conn, "SELECT * FROM `ntk_field_values` WHERE `device_id` =" . $_GET['id']) or die(mysqli_error($conn));
        while ($rowTemplValues = mysqli_fetch_assoc($resTemplValues)) {
            $value = $rowTemplValues['field_value'];
            $selField = "SELECT * FROM `ntk_template_fields` WHERE id =" . $rowTemplValues['field_id'];
            $resField = mysqli_query($conn, $selField) or die(mysqli_error($conn));
            $rowField = mysqli_fetch_assoc($resField);
            if ($rowField['type'] == 'password') {

                $a1 = $value;

                require 'std.encryption.class.php';
                $crypt = new encryption_class;

                $crypt->setAdjustment($adj);
                $crypt->setModulus($mod);

                $adj = $crypt->getAdjustment();
                $mod = $crypt->getModulus();
                $d1 = $crypt->decrypt('1234', $a1);

                $value = $d1; //echo $a1; exit; 
            }
            $fieldname = 'form_' . $rowTemplValues['field_id'];
            echo "<{$fieldname}><![CDATA[" . $value . "]]></{$fieldname}>";
        }
        echo "</data>";
        break;

    case 37:
        $deviceId = filter_input(INPUT_GET, 'device_id', FILTER_SANITIZE_NUMBER_INT);

//        $query = "SELECT
//                            ntk_field_values.id,
//                            ntk_template_fields.`name`,
//                            ntk_field_values.field_value
//                    FROM
//                            ntk_field_values
//                    JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
//                    WHERE
//                            device_id = '{$deviceId}'
//                    AND ntk_template_fields.`name` IN('Info')";

        $query = "SELECT notes FROM ntk_device_records WHERE id=" . $deviceId;
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $row = mysqli_fetch_assoc($result);
        $value = $row['notes'];
        echo json_encode(array("content" => $value));
        break;

    case 38:

        $content = filter_input(INPUT_POST, 'content');
        $deviceId = filter_input(INPUT_POST, 'id', FILTER_SANITIZE_NUMBER_INT);

        /*
          $selField = "SELECT * FROM `ntk_template_fields` WHERE templ_id ='" . $_POST['templ_id'] . "' AND `name` = 'Info' AND common = 1";
          $resField = mysqli_query($conn, $selField) or die(mysqli_error($conn));
          $rowField = mysqli_fetch_assoc($resField);
          $field_id = $rowField['id'];

          if (!$field_id) {

          $insertTemplateFields = "INSERT INTO ntk_template_fields(`name`,`gridname`,`type`,`sort_id`,`templ_id`,`common`,`visible`,`viewer`)SELECT 'Info','Info','tinymce',MAX(sort_id)+1,'" . $_POST['templ_id'] . "','1','0','0' FROM ntk_template_fields WHERE  templ_id=" . $_POST['templ_id'];
          mysqli_query($conn, $insertTemplateFields) or die(mysqli_error($conn));
          $field_id = mysqli_insert_id($conn,);
          }
          //$content = mysqli_real_escape_string($conn, $_POST["content"]);
          $insert = "INSERT INTO ntk_field_values (field_id,device_id,templ_id,field_value) VALUES ({$field_id},{$_POST['id']}," . $_POST['templ_id'] . ",'" . $content . "') ON DUPLICATE KEY UPDATE field_value=VALUES(field_value)";
         */

        $content = mysqli_real_escape_string($conn, $content);
        $update = "UPDATE ntk_device_records SET notes = '" . $content . "' WHERE id =" . $deviceId;
        $updateResult = mysqli_query($conn, $update) or die("SQL Error  " . mysqli_error($conn));
        ;
        if ($updateResult) {
            $data['data'] = array('response' => $updateResult, 'text' => 'Successfully Updated');
        } else {
            $data['data'] = array('response' => $updateResult, 'text' => 'An Error Occured While Saving');
        }
        echo json_encode($data);
        break;

    case 39:
        header("Content-type:text/xml");
        print("<?xml version = \"1.0\"?>");
        echo "<rows>";
        $filer = "#numeric_filter,#numeric_filter";

        $resQry = mysqli_query($conn, "SELECT * FROM ntk_templates WHERE device_id = " . $_GET['id']) or die(mysqli_error($conn));
        $rowQry = mysqli_fetch_assoc($resQry);
        if ($rowQry["id"]) {
            echo "<head>";
            echo ("<column id='id' type='cntr' align='left' sort='int'>Counter</column>");
            echo ("<column id='id' type='ro' align='left' sort='str'>ID</column>");
            $selTemplFields = mysqli_query($conn, "SELECT * FROM ntk_template_fields WHERE templ_id = " . $rowQry["id"] . " AND visible = 1 AND `type` <> 'password' ORDER BY sort_id ASC") or die(mysqli_error($conn));
            while ($resTemplFields = mysqli_fetch_assoc($selTemplFields)) {
                echo ("<column id='" . $resTemplFields['id'] . "' type='ro' align='left' sort='str'><![CDATA[" . $resTemplFields['gridname'] . "]]></column>");
                $filer .= ",#text_filter";
            }
            //$filer = substr($filer, 0, strlen($filer) - 1);
            echo "<afterInit><call command='attachHeader'> <param>" . $filer . "</param></call></afterInit>";
            echo "</head>";
            $sql = "SELECT * FROM ntk_device_records WHERE device_id = " . $_GET['id'];
            $resQry12 = mysqli_query($conn, $sql) or die(mysqli_error($conn));
            while ($rowQry12 = mysqli_fetch_assoc($resQry12)) {
                $qry16 = "SELECT * FROM ntk_field_values WHERE device_id = " . $rowQry12['id'] . " AND templ_id =" . $rowQry['id'] . "";
                $res16 = mysqli_query($conn, $qry16) or die(mysqli_error($conn));

                $fields1 = array();

                while ($row16 = mysqli_fetch_array($res16)) {

                    $fields1[] = $row16['field_value'];
                }
                if (in_array("In Use", $fields1)) {
                    echo "<row id = '" . $rowQry12["id"] . "'>";
                    echo "<cell></cell>";
                    echo "<cell><![CDATA[" . $rowQry12["id"] . "]]></cell>";
                }

                $sql2 = "SELECT * FROM ntk_template_fields WHERE templ_id = " . $rowQry['id'] . " AND visible = 1 AND `type` <> 'password' ORDER BY sort_id ASC";
                $selTemplFields1 = mysqli_query($conn, $sql2) or die(mysqli_error($conn));
                while ($resTemplFields1 = mysqli_fetch_assoc($selTemplFields1)) {

                    $qry1 = "SELECT * FROM ntk_field_values WHERE device_id = " . $rowQry12['id'] . " AND templ_id =" . $rowQry['id'] . "";
                    $res1 = mysqli_query($conn, $qry1) or die(mysqli_error($conn));

                    $fields = array();

                    while ($row1 = mysqli_fetch_array($res1)) {

                        $fields[] = $row1['field_value'];
                    }
                    if (in_array("In Use", $fields)) {
                        $sql3 = "SELECT * FROM ntk_field_values WHERE device_id = " . $rowQry12['id'] . " AND templ_id = " . $rowQry['id'] . " AND field_id = " . $resTemplFields1['id'];
                        $selTemplFieldValues = mysqli_query($conn, $sql3) or die(mysqli_error($conn));
                        $resTemplFieldValues = mysqli_fetch_assoc($selTemplFieldValues);
                        if ($resTemplFieldValues["id"]) {
                            echo "<cell><![CDATA[" . $resTemplFieldValues["field_value"] . "]]></cell>";
                        } else {
                            echo "<cell></cell>";
                        }
                    }
                }
                if (in_array("In Use", $fields1)) {
                    echo "</row>";
                }
            }
        } else {
            echo "<head>";
            $selTemplFields = mysqli_query($conn, "SELECT * FROM ntk_main_fields ORDER BY sort_id ASC") or die(mysqli_error($conn));
            while ($resTemplFields = mysqli_fetch_assoc($selTemplFields)) {
                echo ("<column id='" . $resTemplFields['id'] . "' type='ro' align='left' sort='str'><![CDATA[" . $resTemplFields['gridname'] . "]]></column>");
                $filer .= ",#text_filter";
            }
            //$filer = substr($filer, 0, strlen($filer) - 1);
            echo "<afterInit><call command='attachHeader'> <param>" . $filer . "</param></call></afterInit>";
            echo "</head>";
        }

        echo "</rows>";
        break;

    case 40:

        $parentId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

        $query = "
            SELECT 
              ntk_device_records.id,
              ntk_devices.`name` category,
              ntk_template_fields.`name`,
              ntk_template_fields.description,
              (
                CASE
                  WHEN ntk_template_fields.`name` = 'Description' 
                  AND ntk_template_fields.`common` = '1' 
                  THEN '' 
                  WHEN ntk_template_fields.`name` = 'Branch' 
                  AND ntk_template_fields.`common` = '1' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    Branch_Name 
                  FROM
                    nts_site.branch 
                  WHERE visible = 1 
                    AND Branch_ID = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`name` = 'Room' 
                  AND ntk_template_fields.`common` = '1' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    `name` 
                  FROM
                    `ntk_rooms` 
                  WHERE `id` = (ntk_field_values.field_value)) 
                  ELSE ntk_field_values.field_value 
                END
              ) AS field_value 
            FROM
              ntk_device_records 
              LEFT JOIN ntk_devices 
                ON ntk_device_records.device_id = ntk_devices.id 
              JOIN ntk_field_values 
                ON ntk_device_records.id = ntk_field_values.device_id 
              LEFT JOIN ntk_template_fields 
                ON ntk_field_values.field_id = ntk_template_fields.id 
            WHERE ntk_device_records.id IN 
              (SELECT 
                device_id 
              FROM
                ntk_template_fields 
                JOIN ntk_field_values 
                  ON ntk_template_fields.id = ntk_field_values.field_id 
              WHERE ntk_template_fields.`index_field` = '1' 
                AND ntk_field_values.field_value = {$parentId})";

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $devices = array();

        while ($row = mysqli_fetch_assoc($result)) {
            $devices[$row['id']][$row['category']][$row['name']] = $row['field_value'];
            if ($row['description'] == '1') {
                $devices[$row['id']][$row['category']]['Description'] .= " " . $row['field_value'];
            }
        }

        header('Content-type:text/xml');
        echo '<?xml version = "1.0"?>' . PHP_EOL;
        echo '<rows>';

        foreach ($devices as $id => $category) {
            echo '<row id="' . $id . '">';
            echo '<cell>' . $id . '</cell>';
            foreach ($category as $val => $columns) {
                echo "<cell><![CDATA[" . $columns['Description'] . "]]></cell>";
                echo "<cell><![CDATA[" . $val . "]]></cell>";
                echo '<cell>' . $columns['Date In'] . '</cell>';
                echo '<cell>' . $columns['Status'] . '</cell>';
            }
            echo '</row>';
        }
        echo "</rows>";
        break;

    case 41:

        $deviceId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

        $query = "
            SELECT 
              ntk_device_records.id,
              ntk_devices.`name` category,
              ntk_template_fields.`name`,
              ntk_template_fields.description,
              (
                CASE
                  WHEN ntk_template_fields.`name` = 'Description' 
                  AND ntk_template_fields.`common` = '1' 
                  THEN '' 
                  WHEN ntk_template_fields.`name` = 'Branch' 
                  AND ntk_template_fields.`common` = '1' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    Branch_Name 
                  FROM
                    nts_site.branch 
                  WHERE visible = 1 
                    AND Branch_ID = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`name` = 'Room' 
                  AND ntk_template_fields.`common` = '1' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    `name` 
                  FROM
                    `ntk_rooms` 
                  WHERE `id` = (ntk_field_values.field_value)) 
                  ELSE ntk_field_values.field_value 
                END
              ) AS field_value 
            FROM
              ntk_device_records 
              LEFT JOIN ntk_devices 
                ON ntk_device_records.device_id = ntk_devices.id 
              JOIN ntk_field_values 
                ON ntk_device_records.id = ntk_field_values.device_id 
              LEFT JOIN ntk_template_fields 
                ON ntk_field_values.field_id = ntk_template_fields.id 
            WHERE ntk_device_records.id IN 
              (SELECT 
                ntk_field_values.field_value 
              FROM
                ntk_field_values 
                JOIN ntk_template_fields 
                  ON ntk_field_values.field_id = ntk_template_fields.id 
              WHERE ntk_template_fields.`index_field` = '1' 
                AND ntk_field_values.device_id = {$deviceId})";

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));

        $devices = array();
        while ($row = mysqli_fetch_assoc($result)) {
            $devices[$row['id']][$row['category']][$row['name']] = $row['field_value'];
            if ($row['description'] == '1') {
                $devices[$row['id']][$row['category']]['Description'] .= " " . $row['field_value'];
            }
        }

        header('Content-type:text/xml');
        echo '<?xml version = "1.0"?>' . PHP_EOL;
        echo '<rows>';

        foreach ($devices as $id => $category) {
            echo '<row id="' . $id . '">';
            echo '<cell>' . $id . '</cell>';
            foreach ($category as $val => $columns) {
                echo "<cell><![CDATA[" . $columns['Description'] . "]]></cell>";
                echo "<cell><![CDATA[" . $val . "]]></cell>";
                echo '<cell>' . $columns['Date In'] . '</cell>';
                echo '<cell>' . $columns['Status'] . '</cell>';
            }
            echo '</row>';
        }
        echo "</rows>";
        break;

    case 42:
        header("Content-type:text/xml");
        echo '<?xml version = "1.0"?>' . PHP_EOL;
        echo "<data>";
        $resQry = mysqli_query($conn, "SELECT a.*,b.name FROM ntk_templates a LEFT JOIN ntk_devices b ON a.device_id = b.id WHERE b.id =" . $_GET['id']) or die(mysqli_error($conn));
        while ($rowQry = mysqli_fetch_assoc($resQry)) {
            echo "<id><![CDATA[" . $rowQry["id"] . "]]></id>";
            echo "<name><![CDATA[" . $rowQry["name"] . "]]></name>";
            echo "<layer><![CDATA[" . $rowQry["layer"] . "]]></layer>";
            echo "<master_id><![CDATA[" . $rowQry["master_id"] . "]]></master_id>";
            echo "<details_table><![CDATA[" . $rowQry["details_table"] . "]]></details_table>";
            echo "<create_barcode><![CDATA[" . $rowQry["create_barcode"] . "]]></create_barcode>";
            echo "<formgridname><![CDATA[" . $rowQry["formgridname"] . "]]></formgridname>";
            echo "<protect><![CDATA[" . $rowQry["protect"] . "]]></protect>";
            echo "<excel_url><![CDATA[" . $rowQry["excel_url"] . "]]></excel_url>";
            echo "<sheet_name><![CDATA[" . $rowQry["sheet_name"] . "]]></sheet_name>";
            echo "<show_in_threejs><![CDATA[" . $rowQry["show_in_threejs"] . "]]></show_in_threejs>";
            echo "<webshop_category><![CDATA[" . $rowQry["webshop_category"] . "]]></webshop_category>";
        }
        echo "</data>";
        break;

    case 43:

        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

//        $privilege = mysql_result(mysqli_query($conn, "SELECT
//                            priviledges.write_privilege
//                    FROM
//                            user_management.program_user_privileges priviledges
//                    WHERE
//                            priviledges.program_id = 1
//                    AND priviledges.item_level > 0
//                    AND priviledges.user_id = " . $loggedUserId . "
//                    AND priviledges.item_id = " . $id), 0, 0);
//
//        if ($privilege === '1') {

        if (empty($_POST['layer'])) {
            $layer = 'null';
        } else {
            $layer = $_POST['layer'];
        }

        if (empty($_POST['master_id'])) {
            $master_id = 'null';
        } else {
            $master_id = $_POST['master_id'];
        }

        $update = "UPDATE ntk_devices SET `name`= '{$_POST['name']}' WHERE id =" . $id;
        $resQry = mysqli_query($conn, $update) or die(mysqli_error($conn) . $update);
//        $update = "UPDATE ntk_templates SET details_table= '{$_POST['details_table']}',layer ='{$layer}'  WHERE id =" . $_POST['id'];echo $update; exit;
        if ($master_id > 0) {
            //checkIfMasterIdExists
            $resultQ = mysqli_query($conn, "SELECT master_id FROM ntk_templates WHERE id =" . $_POST['id']);
            $rowQ = mysqli_fetch_assoc($resultQ);
            $masterIdExists = $rowQ['master_id'];

            if ($masterIdExists > 0) {
                //check if the template has records
                $resultR = mysqli_query($conn, "SELECT COUNT(1) amount FROM ntk_device_records WHERE device_id =" . $id);
                $rowR = mysqli_fetch_assoc($resultR);
                $templateRecords = $rowR['amount'];

                if ($templateRecords > 0) {
                    //alert another master id exists
                    $data['data'] = array('success' => false, 'text' => 'The existing template cannot be overwritten since it has records');
                } else {
                    //delete current template fields
                    $deleteFields = mysqli_query($conn, "DELETE FROM ntk_template_fields WHERE templ_id=" . $_POST['id']);
                    //insert master template fields with current template id as templ_id
                    $query = "SELECT * FROM ntk_template_fields WHERE templ_id =" . $master_id;
                    $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
                    $insert = array();
                    while ($row = mysqli_fetch_assoc($result)) {
                        $insertNewFields = "INSERT INTO ntk_template_fields (`name`,`parent_id`,`type`,`sort_id`,`templ_id`,`visible`,`common`,`field_unique`,`field_procedure`,`index_field`,`index_id`,`description`,`visible_in_form`,`viewer`,`show_field`,`readonly`,`default_txt`,`copy`,`value`,`width`) VALUES ('" . $row['name'] . "','" . $row['parent_id'] . "','" . $row['type'] . "','" . $row['sort_id'] . "'," . $_POST['id'] . ",'" . $row['visible'] . "','" . $row['common'] . "','" . $row['field_unique'] . "','" . $row['field_procedure'] . "','" . $row['index_field'] . "','" . $row['index_id'] . "','" . $row['description'] . "','" . $row['visible_in_form'] . "','" . $row['viewer'] . "','" . $row['show_field'] . "','" . $row['readonly'] . "','" . $row['default_txt'] . "','" . $row['copy'] . "','" . $row['value'] . "','" . $row['width'] . "')";

                        $insertNewFieldsResult = mysqli_query($conn, $insertNewFields) or die(mysqli_error($conn));
                        if ($insertNewFieldsResult) {
                            $field_id = mysqli_insert_id($conn,);

                            //insert master template fields options
                            $query_1 = "SELECT * FROM ntk_fields_options WHERE field_id =" . $row['id'];
                            $result_1 = mysqli_query($conn, $query_1) or die(mysqli_error($conn));

                            while ($row_1 = mysqli_fetch_assoc($result_1)) {
                                $insert[] = "('" . $row_1['sort_id'] . "','" . $row_1['name'] . "','" . $row_1['visible'] . "'," . $field_id . ",'" . $row_1['default_value'] . "','" . $row_1['parent_id'] . "')";
                            }
                        }
                    }

                    if (count($insert) > 0) {
                        $query = "INSERT INTO ntk_fields_options (`sort_id`,`name`,`visible`,`field_id`,`default_value`,`parent_id`)  VALUES " . implode(',', $insert) . " ON DUPLICATE KEY UPDATE `name`=VALUES(name)";
                        mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);
                    }

                    $query = "SELECT * FROM ntk_template_fields WHERE templ_id =" . $_POST['id'] . " AND parent_id > 0";
                    $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
                    while ($row = mysqli_fetch_assoc($result)) {

                        $resultR = mysqli_query($conn, "SELECT id FROM ntk_template_fields WHERE templ_id = " . $row['templ_id'] . " AND `name`=(SELECT `name` FROM ntk_template_fields WHERE id = " . $row['parent_id'] . ")");
                        $rowR = mysqli_fetch_assoc($resultR);
                        $parentId = $rowR['id'];

                        $updateParent = mysqli_query($conn, "UPDATE ntk_template_fields SET parent_id = " . $parentId . " WHERE id = " . $row['id']);

                        $query_1 = "SELECT * FROM ntk_fields_options WHERE field_id =" . $row['id'] . " AND parent_id > 0";
                        $result_1 = mysqli_query($conn, $query_1) or die(mysqli_error($conn));
                        while ($row_1 = mysqli_fetch_assoc($result_1)) {

                            $resultR = mysqli_query($conn, "SELECT id FROM ntk_fields_options WHERE field_id = " . $row_1['field_id'] . " AND `name`=(SELECT `name` FROM ntk_fields_options WHERE id = " . $row_1['parent_id'] . ")");
                            $rowR = mysqli_fetch_assoc($resultR);
                            $parentId_1 = $rowR['id'];

                            $updateParent_1 = mysqli_query($conn, "UPDATE ntk_fields_options SET parent_id = " . $parentId . " WHERE id = " . $row_1['id']);
                        }
                    }

                    $update = "UPDATE ntk_templates SET details_table= '{$_POST['details_table']}',layer ={$layer},create_barcode='{$_POST['create_barcode']}',master_id='{$master_id}',excel_url = '{$_POST['excel_url']}',sheet_name = '{$_POST['sheet_name']}',show_in_threejs = '{$_POST['show_in_threejs']}',webshop_category = '{$_POST['webshop_category']}'  WHERE id =" . $_POST['id'];
                    $resQry = mysqli_query($conn, $update) or die(mysqli_error($conn) . $update);
                    if ($resQry) {
                        $data['data'] = array('success' => $resQry, 'text' => 'Successfully Saved');
                    } else {
                        $data['data'] = array('success' => $resQry, 'text' => 'An Error Occured during Saving');
                    }
                }
            } else {
                //delete current template fields
                $deleteFields = mysqli_query($conn, "DELETE FROM ntk_template_fields WHERE templ_id=" . $_POST['id']);
                //insert master template fields with current template id as templ_id
                $query = "SELECT * FROM ntk_template_fields WHERE templ_id =" . $master_id;
                $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
                $insert = array();
                while ($row = mysqli_fetch_assoc($result)) {
                    $insertNewFields = "INSERT INTO ntk_template_fields (`name`,`parent_id`,`type`,`sort_id`,`templ_id`,`visible`,`common`,`field_unique`,`field_procedure`,`index_field`,`index_id`,`description`,`visible_in_form`,`viewer`,`show_field`,`readonly`,`default_txt`,`copy`,`value`,`width`) VALUES ('" . $row['name'] . "','" . $row['parent_id'] . "','" . $row['type'] . "','" . $row['sort_id'] . "'," . $_POST['id'] . ",'" . $row['visible'] . "','" . $row['common'] . "','" . $row['field_unique'] . "','" . $row['field_procedure'] . "','" . $row['index_field'] . "','" . $row['index_id'] . "','" . $row['description'] . "','" . $row['visible_in_form'] . "','" . $row['viewer'] . "','" . $row['show_field'] . "','" . $row['readonly'] . "','" . $row['default_txt'] . "','" . $row['copy'] . "','" . $row['value'] . "','" . $row['width'] . "')";

                    $insertNewFieldsResult = mysqli_query($conn, $insertNewFields) or die(mysqli_error($conn));
                    if ($insertNewFieldsResult) {
                        $field_id = mysqli_insert_id($conn,);

                        //insert master template fields options
                        $query_1 = "SELECT * FROM ntk_fields_options WHERE field_id =" . $row['id'];
                        $result_1 = mysqli_query($conn, $query_1) or die(mysqli_error($conn));

                        while ($row_1 = mysqli_fetch_assoc($result_1)) {
                            $insert[] = "('" . $row_1['sort_id'] . "','" . $row_1['name'] . "','" . $row_1['visible'] . "'," . $field_id . ",'" . $row_1['default_value'] . "','" . $row_1['parent_id'] . "')";
                        }
                    }
                }

                if (count($insert) > 0) {
                    $query = "INSERT INTO ntk_fields_options (`sort_id`,`name`,`visible`,`field_id`,`default_value`,`parent_id`)  VALUES " . implode(',', $insert) . " ON DUPLICATE KEY UPDATE `name`=VALUES(name)";
                    mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);
                }

                $query = "SELECT * FROM ntk_template_fields WHERE templ_id =" . $_POST['id'] . " AND parent_id > 0";
                $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
                while ($row = mysqli_fetch_assoc($result)) {

                    $resultR = mysqli_query($conn, "SELECT id FROM ntk_template_fields WHERE templ_id = " . $row['templ_id'] . " AND `name`=(SELECT `name` FROM ntk_template_fields WHERE id = " . $row['parent_id'] . ")");
                    $rowR = mysqli_fetch_assoc($resultR);
                    $parentId = $rowR['id'];

                    $updateParent = mysqli_query($conn, "UPDATE ntk_template_fields SET parent_id = " . $parentId . " WHERE id = " . $row['id']);

                    $query_1 = "SELECT * FROM ntk_fields_options WHERE field_id =" . $row['id'] . " AND parent_id > 0";
                    $result_1 = mysqli_query($conn, $query_1) or die(mysqli_error($conn));
                    while ($row_1 = mysqli_fetch_assoc($result_1)) {

                        $resultR = mysqli_query($conn, "SELECT id FROM ntk_fields_options WHERE field_id = " . $row_1['field_id'] . " AND `name`=(SELECT `name` FROM ntk_fields_options WHERE id = " . $row_1['parent_id'] . ")");
                        $rowR = mysqli_fetch_assoc($resultR);
                        $parentId_1 = $rowR['id'];

                        $updateParent_1 = mysqli_query($conn, "UPDATE ntk_fields_options SET parent_id = " . $parentId . " WHERE id = " . $row_1['id']);
                    }
                }

                $update = "UPDATE ntk_templates SET details_table= '{$_POST['details_table']}',layer ={$layer},create_barcode='{$_POST['create_barcode']}',master_id='{$master_id}',excel_url = '{$_POST['excel_url']}',sheet_name = '{$_POST['sheet_name']}',show_in_threejs = '{$_POST['show_in_threejs']}',webshop_category = '{$_POST['webshop_category']}'  WHERE id =" . $_POST['id'];
                $resQry = mysqli_query($conn, $update) or die(mysqli_error($conn) . $update);
                if ($resQry) {
                    $data['data'] = array('success' => $resQry, 'text' => 'Successfully Saved');
                } else {
                    $data['data'] = array('success' => $resQry, 'text' => 'An Error Occured during Saving');
                }
            }
        } else {
            //checkIfMasterIdExists
            $resultR = mysqli_query($conn, "SELECT master_id FROM ntk_templates WHERE id =" . $_POST['id']);
            $rowR = mysqli_fetch_assoc($resultR);
            $masterIdExists = $rowR['master_id'];

            if ($masterIdExists > 0) {
                //check if the template has records
                $resultR = mysqli_query($conn, "SELECT COUNT(1) amount FROM ntk_device_records WHERE device_id =" . $id);
                $rowR = mysqli_fetch_assoc($resultR);
                $templateRecords = $rowR['amount'];

                if ($templateRecords > 0) {
                    //alert another master id exists
                    $data['data'] = array('success' => false, 'text' => 'The existing template cannot be overwritten since it has records');
                } else {
                    //delete current template fields
                    $deleteFields = mysqli_query($conn, "DELETE FROM ntk_template_fields WHERE templ_id=" . $_POST['id']);
                    $update = "UPDATE ntk_templates SET details_table= '{$_POST['details_table']}',layer ={$layer},create_barcode='{$_POST['create_barcode']}',master_id='{$master_id}',excel_url = '{$_POST['excel_url']}',sheet_name = '{$_POST['sheet_name']}',show_in_threejs = '{$_POST['show_in_threejs']}',webshop_category = '{$_POST['webshop_category']}'  WHERE id =" . $_POST['id'];
                    $resQry = mysqli_query($conn, $update) or die(mysqli_error($conn) . $update);
                    if ($resQry) {
                        $data['data'] = array('success' => $resQry, 'text' => 'Successfully Saved');
                    } else {
                        $data['data'] = array('success' => $resQry, 'text' => 'An Error Occured during Saving');
                    }
                }
            } else {

                $update = "UPDATE ntk_templates SET details_table= '{$_POST['details_table']}',layer ={$layer},create_barcode='{$_POST['create_barcode']}',master_id='{$master_id}',formgridname='{$formgridname}',protect='{$protect}',excel_url = '{$_POST['excel_url']}',sheet_name = '{$_POST['sheet_name']}',show_in_threejs = '{$_POST['show_in_threejs']}',webshop_category = '{$_POST['webshop_category']}'  WHERE id =" . $_POST['id'];
                $resQry = mysqli_query($conn, $update) or die(mysqli_error($conn) . $update);
                if ($resQry) {
                    $data['data'] = array('success' => $resQry, 'text' => 'Successfully Saved');
                } else {
                    $data['data'] = array('success' => $resQry, 'text' => 'An Error Occured during Saving');
                }
            }
        }
//        } else {
//            $data['data'] = array('response' => false, 'text' => 'You Dont Have Permissions to Update This Template');
//        }

        if (isset($_POST['show_in_threejs']) && $_POST['show_in_threejs'] == '1') {

            $resultR = mysqli_query($conn, "SELECT parent_id FROM ntk_devices WHERE id =" . $id);
            $rowR = mysqli_fetch_assoc($resultR);
            $parentId = $rowR['parent_id'];

            if ($parentId > 0) {
                mysqli_query($conn, "UPDATE ntk_templates SET show_in_threejs = 1 WHERE device_id = " . $parentId) or die(mysqli_error($conn));
            }
        }

        echo json_encode($data);
        break;

    case 44:

        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $query = "SELECT
                            info
                    FROM
                            ntk_details
                    WHERE
                            id = {$id}";
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $row = mysqli_fetch_assoc($result);
        $value = $row['info'];
        echo json_encode(array("content" => $value));
        break;

    case 45;

        $items = filter_input(INPUT_GET, 'items', FILTER_SANITIZE_NUMBER_INT);
        $parentId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $items = $_GET['items'];
        $start_point = $_GET['start_point'];
        $end_point = $start_point + $items;

        $ports1 = array();
        $ports2 = array();
        $response = true;
        for ($i = $start_point; $i < $end_point; $i++) {
            $ports1[] = $i;
        }
        $query = "SELECT port_id FROM ntk_details WHERE parent_id = " . $parentId;
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        while ($row = mysqli_fetch_assoc($result)) {
            $ports2[] = $row['port_id'];
        }
        if (array_intersect($ports1, $ports2)) {
            $response = false;
            $msg = 'Do you want to overwrite existing ports?';
        } else {
            for ($i = 0; $i < count($ports1); $i++) {
                $QRY_INSERT_DEVICE = "INSERT INTO ntk_details(`parent_id`,`port_id`) VALUES('{$parentId}','{$ports1[$i]}')";
                if (mysqli_query($conn, $QRY_INSERT_DEVICE)) {
                    $id = mysqli_insert_id($conn,);
                    $msg = "Successfully Added New Item";
                } else {
                    $msg = mysqli_error($conn);
                }
            }
        }
//        exit;
//        print "<pre>";
//        print_r(array_intersect($ports1, $ports2));
//        print "</pre>";
//        exit;

        echo json_encode(array("response" => $response, "newId" => $id, "message" => $msg));
        break;

    case 46:

        $parentId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

        $query = "SELECT * FROM ntk_details WHERE parent_id = '{$parentId}'";
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $details = array();
        while ($row = mysqli_fetch_assoc($result)) {
            $obj = new stdClass;
            $obj->id = $row['id'];
            $obj->parent_id = $row['parent_id'];
            $obj->port_id = $row['port_id'];
            $obj->connection_id = $row['connection_id'];
            $obj->is_option = $row['is_option'];
            $details[] = $obj;
        }
        header('Content-type:text/xml');
        echo '<?xml version = "1.0"?>' . PHP_EOL;
        echo '<rows>';

        foreach ($details as $val) {
            $query = "SELECT
                                ntk_field_values.id,
                                ntk_template_fields.`name`,
                                ntk_field_values.`device_id`,
                                (
                                        CASE
                                        WHEN ntk_template_fields.`name` = 'Description'
                                        AND ntk_template_fields.`common` = '1' THEN
                                                ''
                                        WHEN ntk_template_fields.`name` = 'Branch'
                                        AND ntk_template_fields.`common` = '1'
                                        AND ntk_field_values.field_value > 0 THEN
                                                (
                                                        SELECT
                                                                Branch_Name
                                                        FROM
                                                                nts_site.branch
                                                        WHERE
                                                                visible = 1
                                                        AND Branch_ID =(
                                                                ntk_field_values.field_value
                                                        )
                                                )
                                        WHEN ntk_template_fields.`name` = 'Room'
                                        AND ntk_template_fields.`common` = '1'
                                        AND ntk_field_values.field_value > 0 THEN
                                                (
                                                        SELECT
                                                                `name`
                                                        FROM
                                                                `ntk_rooms`
                                                        WHERE
                                                                `id` =(
                                                                        ntk_field_values.field_value
                                                                )
                                                )
                                        ELSE
                                                ntk_field_values.field_value
                                        END
                                )AS field_value
                        FROM
                                ntk_field_values
                        JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
                        WHERE
                                device_id =
                        IF(
                                (
                                        (
                                                SELECT
                                                        ntk_details.is_option
                                                FROM
                                                        ntk_details
                                                WHERE
                                                        id = '{$val->id}'
                                        )= 1
                                ),
                                (
                                        SELECT
                                                ntk_details.parent_id
                                        FROM
                                                ntk_details
                                        WHERE
                                                id = '{$val->connection_id}'
                                ),
                                '{$val->connection_id}'
                        )
                        AND ntk_template_fields.`description` = 1
                        ORDER BY
                                ntk_template_fields.sort_id ASC"; //echo $query; exit;

            $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
            $desc = array();
            while ($row = mysqli_fetch_assoc($result)) {
                $obj = new stdClass;
                $obj->id = $row['id'];
                $obj->description = $row['field_value'];
                $obj->position = $row['Position in Rack'];
                $desc[] = $obj;
            }
//            print('<pre>');
//            print_r($desc);
//            exit;
            $description = '';
            foreach ($desc as $column) {
                $description .= $column->description . ' ';
            }
            if ($val->is_option == '1') {
                $resultR = mysqli_query($conn, "SELECT port_id FROM ntk_details WHERE id=" . $val->connection_id);
                $rowR = mysqli_fetch_assoc($resultR);
                $portId = $rowR['port_id'];

                $description .= '- Port ID: ' . $portId;
            }
            echo '<row id="' . $val->id . '">';
            echo "<cell><![CDATA[" . $val->id . "]]></cell>";
            echo "<cell><![CDATA[" . $val->parent_id . "]]></cell>";
            echo "<cell><![CDATA[" . $val->port_id . "]]></cell>";
            echo "<cell><![CDATA[" . $val->connection_id . "]]></cell>";
            echo "<cell><![CDATA[" . $val->is_option . "]]></cell>";
            echo "<cell><![CDATA[" . $description . "]]></cell>";
            echo '</row>';
            unset($desc);
        }
        echo '</rows>';
        break;

    case 47:
        $index = $_GET["index"];
        $fieldvalue = $_GET["fieldvalue"];
        $id = $_GET["id"];
        $field = $_GET["colId"];
        $colType = $_GET["colType"];
        $fieldvalue = mysqli_real_escape_string($conn, $fieldvalue);

        $updateResult = updateSQL("ntk_details", $field, $fieldvalue, $id, "id", $colType);
        if ($updateResult) {
            $data['data'] = array('response' => $updateResult, 'text' => 'Successfully Updated');
        } else {
            $data['data'] = array('response' => $updateResult, 'text' => 'An Error Occured While Saving');
        }

        echo json_encode($data);

        break;

    case 48:

        $data = array();
        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $query = "SELECT
                            ntk_template_fields.id,
                            ntk_template_fields.`name`
                    FROM
                            ntk_template_fields
                    JOIN ntk_templates ON ntk_template_fields.templ_id = ntk_templates.id
                    JOIN ntk_devices ON ntk_templates.device_id = ntk_devices.id
                    WHERE
                            ntk_devices.id = '{$id}'
                    AND ntk_template_fields.type = 'combo'
                    AND ntk_template_fields.`name` IN(
                            'Branch',
                            'Room',
                            'Main Category',
                            'Sub category'
                    )";

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        while ($row = mysqli_fetch_assoc($result)) {
            switch (strtolower($row['name'])) {
                case 'branch':
                    $data['branch'] = 'form_' . $row['id'];
                    break;
                case 'room':
                    $data['office'] = 'form_' . $row['id'];
                    break;
                case 'main category':
                    $data['category'] = 'form_' . $row['id'];
                    break;
                case 'sub category':
                    $data['subcategory'] = 'form_' . $row['id'];
                    break;
            }
        }
        echo json_encode($data);
        break;

    case 49:
        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $value = filter_input(INPUT_GET, 'value', FILTER_SANITIZE_NUMBER_INT);
        $query = "SELECT * FROM ntk_rooms WHERE branch_id = '{$id}' ORDER BY parent_id=0 DESC, sort_id";

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $devices = array();
        while ($row = mysqli_fetch_assoc($result)) {
            $obj = new stdClass();
            $obj->name = $row['name'];
            $obj->parent = $row['parent_id'];
            $obj->id = $row['id'];
            $devices[$row['id']] = $obj;
        }
//print_r($devices);exit();
        $newdevice;
        foreach ($devices as $device) {
            if ($device->parent > 0) {
                $newdevice[$device->id] = $device;
                $newdevice[$device->id]->newname = $devices[$device->parent]->name . "-" . $device->name;
            }
        }
        header("Content-type:text/xml");
        echo '<?xml version = "1.0"?>' . PHP_EOL;
        echo "<complete>";
// echo("<option value=''></option>");
        foreach ($newdevice as $columns) {
            if ($columns->id == $value) {
                $selected = '1';
            } else {
                $selected = '0';
            }
            echo("<option value='" . $columns->id . "' selected='" . $selected . "'>{$columns->newname}</option>");
        }
        echo "</complete>";
        break;

    case 50:
        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $qry_index = "SELECT index_id FROM ntk_template_fields WHERE id =" . $id;
        $res_index = mysqli_query($conn, $qry_index) or die(mysqli_error($conn));
        $row_index = mysqli_fetch_assoc($res_index);
        $indexId = $row_index['index_id'];

        $query = "
                SELECT
                    ntk_template_fields.`name`,
                    ntk_device_records.id,
                    (
                        CASE
                        WHEN ntk_template_fields.`name` = 'Description'
                        AND ntk_template_fields.`common` = '1' THEN
                                ''
                        WHEN ntk_template_fields.`name` = 'Branch'
                        AND ntk_template_fields.`common` = '1'
                        AND ntk_field_values.field_value > 0 THEN
                            (
                                SELECT
                                        Branch_Name
                                FROM
                                        nts_site.branch
                                WHERE
                                        visible = 1
                                AND Branch_ID =(
                                        ntk_field_values.field_value
                                )
                            )
                        WHEN ntk_template_fields.`name` = 'Room'
                        AND ntk_template_fields.`common` = '1'
                        AND ntk_field_values.field_value > 0 THEN
                            (
                                SELECT
                                    `name`
                                FROM
                                    `ntk_rooms`
                                WHERE
                                    `id` =(
                                        ntk_field_values.field_value
                                    )
                            )        
                        ELSE
                            ntk_field_values.field_value
                        END
                    )AS field_value
            FROM
                    ntk_device_records
            JOIN ntk_templates ON ntk_templates.device_id = ntk_device_records.device_id
            JOIN ntk_field_values ON ntk_device_records.id = ntk_field_values.device_id
            JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
            AND ntk_template_fields.templ_id = ntk_templates.id
            /*JOIN(
                    SELECT
                        device_id
                    FROM
                        ntk_field_values
                    WHERE
                        field_value IN('In Use', 'Planned')
            )activeDevices ON ntk_device_records.id = activeDevices.device_id*/
            WHERE
                ntk_templates.device_id IN(
                    SELECT
                        ntk_devices.id device_id
                    FROM
                        ntk_templates
                    JOIN ntk_devices ON ntk_templates.device_id = ntk_devices.id
                    AND ntk_templates.id = {$indexId}
                )
            AND ntk_template_fields.`description` = 1
            ORDER BY
                ntk_device_records.id,
                ntk_template_fields.sort_id";

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $devices = array();
        while ($row = mysqli_fetch_assoc($result)) {
            $devices[$row['id']][] = $row['field_value'];
        }
        header("Content-type:text/xml");
        echo '<?xml version = "1.0"?>' . PHP_EOL;
        echo '<rows>';
        foreach ($devices as $id => $columns) {
            $value = '';
            foreach ($columns as $val) {
                $value .= $val . " ";
            }
            echo '<row id="' . $id . '">';
            echo "<cell><![CDATA[" . $id . "]]></cell>";
            echo "<cell><![CDATA[" . $value . "]]></cell>";
            echo "<cell>0</cell>";
            echo '</row>';
        }
        echo '</rows>';
        break;

    case 51:

        $newValue = $_POST['nValue'];
        $qry_index = "SELECT index_field,`name`,index_id FROM ntk_template_fields WHERE id =" . $_POST['field_id'];
        $res_index = mysqli_query($conn, $qry_index) or die(mysqli_error($conn));
        $row_index = mysqli_fetch_assoc($res_index);
        $indexField = $row_index['index_field'];

        if ($indexField === '0' && $row_index['index_id'] > 0) {

            $resultR = mysqli_query($conn, "SELECT field_value FROM ntk_field_values WHERE device_id = " . $newValue . " AND templ_id=" . $row_index['index_id'] . "  AND `field_id` =(SELECT id FROM ntk_template_fields WHERE `name` ='" . $row_index['name'] . "' AND templ_id=" . $row_index['index_id'] . ")");

            $rowR = mysqli_fetch_assoc($resultR);
            $newValue = $rowR['field_value'];
        }

        $updateResult = mysqli_query($conn, "INSERT INTO ntk_field_values(`device_id`,`templ_id`,`field_id`,`field_value`) VALUES ({$_POST['device_id']},{$_POST['templ_id']},{$_POST['field_id']},'{$newValue}') ON DUPLICATE KEY UPDATE field_value='" . $newValue . "'") or die("SQL Error  " . mysqli_error($conn));

        if ($updateResult) {
            $data['data'] = array('response' => $updateResult, 'text' => 'Successfully Updated');
        } else {
            $data['data'] = array('response' => $updateResult, 'text' => 'An Error Occured While Saving');
        }
        echo json_encode($data);
        break;

    case 52:
        $query = "SELECT field_value FROM ntk_field_values WHERE field_id = '{$_GET['field_id']}' AND device_id = {$_GET['device_id']}"; //echo $query; exit;
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $row = mysqli_fetch_assoc($result);
        $value = $row['field_value'];

        echo json_encode(array("value" => $value));
        break;

    case 53:

        $deviceId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

        $query = "SELECT
                            ntk_device_records.id,
                            ntk_devices.`name` category,
                            ntk_template_fields.`name`,
                            ntk_template_fields.description,
                            (
                                    CASE
                                    WHEN ntk_template_fields.`name` = 'Description'
                                    AND ntk_template_fields.`common` = '1' THEN
                                            ''
                                    WHEN ntk_template_fields.`name` = 'Branch'
                                    AND ntk_template_fields.`common` = '1'
                                    AND ntk_field_values.field_value > 0 THEN
                                            (
                                                    SELECT
                                                            Branch_Name
                                                    FROM
                                                            nts_site.branch
                                                    WHERE
                                                            visible = 1
                                                    AND Branch_ID =(
                                                            ntk_field_values.field_value
                                                    )
                                            )
                                    WHEN ntk_template_fields.`name` = 'Room'
                                    AND ntk_template_fields.`common` = '1'
                                    AND ntk_field_values.field_value > 0 THEN
                                            (
                                                    SELECT
                                                            `name`
                                                    FROM
                                                            `ntk_rooms`
                                                    WHERE
                                                            `id` =(
                                                                    ntk_field_values.field_value
                                                            )
                                            )        
                                    ELSE
                                            ntk_field_values.field_value
                                    END
                            )AS field_value
                    FROM
                            ntk_device_records
                    LEFT JOIN ntk_devices ON ntk_device_records.device_id = ntk_devices.id
                    JOIN ntk_field_values ON ntk_device_records.id = ntk_field_values.device_id
                    LEFT JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
                    WHERE
                            ntk_device_records.id IN(
                                    SELECT
                                            device_id
                                    FROM
                                            ntk_template_fields
                                    JOIN ntk_field_values ON ntk_template_fields.id = ntk_field_values.field_id
                                    WHERE
                                            ntk_template_fields.`index_field` = '1'
                                    AND ntk_field_values.field_value = '{$deviceId}'
                            )
                    ORDER BY
                            ntk_device_records.id,
                            ntk_template_fields.sort_id";
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $devices = array();
        while ($row = mysqli_fetch_assoc($result)) {

            $devices[$row['id']][$row['category']][$row['name']] = $row['field_value'];
            if ($row['description'] == '1') {
                $devices[$row['id']][$row['category']]['Description'] .= " " . $row['field_value'];
            }
        }

        $query_children = "SELECT
                                    device_id
                            FROM
                                    ntk_template_fields
                            JOIN ntk_field_values ON ntk_template_fields.id = ntk_field_values.field_id
                            WHERE
                                    ntk_template_fields.`index_field` = '1'
                            AND ntk_field_values.field_value = {$deviceId}";
        $res_children = mysqli_query($conn, $query_children) or die(mysqli_error($conn));
        $childDevices = array();
        while ($row_children = mysqli_fetch_assoc($res_children)) {
            $childDevices[] = $row_children['device_id'];
        }
        $exclude = implode(',', $childDevices);

        $query_ = "SELECT
                            ntk_device_records.id,
                            ntk_devices.`name` category,
                            ntk_template_fields.`name`,
                            ntk_template_fields.description,
                            (
                                    CASE
                                    WHEN ntk_template_fields.`name` = 'Description'
                                    AND ntk_template_fields.`common` = '1' THEN
                                            ''
                                    WHEN ntk_template_fields.`name` = 'Branch'
                                    AND ntk_template_fields.`common` = '1'
                                    AND ntk_field_values.field_value > 0 THEN
                                            (
                                                    SELECT
                                                            Branch_Name
                                                    FROM
                                                            nts_site.branch
                                                    WHERE
                                                            visible = 1
                                                    AND Branch_ID =(
                                                            ntk_field_values.field_value
                                                    )
                                            )
                                    WHEN ntk_template_fields.`name` = 'Room'
                                    AND ntk_template_fields.`common` = '1'
                                    AND ntk_field_values.field_value > 0 THEN
                                            (
                                                    SELECT
                                                            `name`
                                                    FROM
                                                            `ntk_rooms`
                                                    WHERE
                                                            `id` =(
                                                                    ntk_field_values.field_value
                                                            )
                                            )        
                                    ELSE
                                            ntk_field_values.field_value
                                    END
                            )AS field_value
                    FROM
                            ntk_device_records
                    LEFT JOIN ntk_devices ON ntk_device_records.device_id = ntk_devices.id
                    JOIN ntk_field_values ON ntk_device_records.id = ntk_field_values.device_id
                    LEFT JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
                    WHERE
                            ntk_device_records.id IN(
                                    SELECT
                                            ntk_field_values.field_value
                                    FROM
                                            ntk_field_values
                                    JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
                                    WHERE
                                            ntk_template_fields.`index_field` = '1'
                                    AND ntk_field_values.device_id = '{$deviceId}'
                            )
                    ORDER BY
                            ntk_device_records.id,
                            ntk_template_fields.sort_id";

        $result_ = mysqli_query($conn, $query_) or die(mysqli_error($conn));
        $devices_ = array();
        while ($row_ = mysqli_fetch_assoc($result_)) {
            $devices_[$row_['id']][$row_['category']][$row_['name']] = $row_['field_value'];
            if ($row_['description'] == '1') {
                $devices_[$row_['id']][$row_['category']]['Description'] .= " " . $row_['field_value'];
            }
        }

        header('Content-type:text/xml');
        echo '<?xml version = "1.0"?>' . PHP_EOL;
        echo '<rows>';
        echo '<row id="1_0">';
        echo "<cell image=\"folder.gif\">Contains (Child Ojects)</cell>";
        foreach ($devices as $id => $category) {
            echo '<row id="' . $id . '">';
            foreach ($category as $val => $columns) {

                $result_chld = mysqli_query($conn, "SELECT
                                    COUNT(device_id) amount
                            FROM
                                    ntk_template_fields
                            JOIN ntk_field_values ON ntk_template_fields.id = ntk_field_values.field_id
                            WHERE
                                    ntk_template_fields.`index_field` = '1'
                            AND ntk_field_values.field_value = '{$id}'
                            AND device_id NOT IN(" . $exclude . ")");

                $row_chld = mysqli_fetch_assoc($result_chld);
                $children = $row_chld['amount'];

                if ($children > 0) {
                    echo "<cell image=\"folder.gif\"><![CDATA[" . $columns['Description'] . "]]></cell>";
                } else {
                    echo "<cell><![CDATA[" . $columns['Description'] . "]]></cell>";
                }
                echo '<cell>' . $id . '</cell>';
                echo "<cell><![CDATA[" . $val . "]]></cell>";
                echo "<cell><![CDATA[" . $columns['Branch'] . "]]></cell>";
                echo "<cell><![CDATA[" . $columns['Room'] . "]]></cell>";
                echo "<cell><![CDATA[" . $columns['Status'] . "]]></cell>";
                getChildObjects($id, $deviceId);
            }
            echo '</row>';
        }
        echo '</row>';
        echo '<row id="2_0">';
        echo "<cell image=\"folder.gif\">Connected to (Parent Objects)</cell>";
        foreach ($devices_ as $id => $category) {
            echo '<row id="' . $id . '">';
            foreach ($category as $val => $columns) {
                echo "<cell><![CDATA[" . $columns['Description'] . "]]></cell>";
                echo '<cell>' . $id . '</cell>';
                echo "<cell><![CDATA[" . $val . "]]></cell>";
                echo "<cell><![CDATA[" . $columns['Branch'] . "]]></cell>";
                echo "<cell><![CDATA[" . $columns['Room'] . "]]></cell>";
                echo "<cell><![CDATA[" . $columns['Status'] . "]]></cell>";
            }
            echo '</row>';
        }
        echo '</row>';
        echo "</rows>";
        break;

    case 54:

        $deviceId = filter_input(INPUT_GET, 'device_id', FILTER_SANITIZE_NUMBER_INT);
        $query = "SELECT
	ntk_template_fields.`name`,
        ntk_template_fields.index_field,
        ntk_template_fields.description,
	(
		CASE
		WHEN ntk_template_fields.`name` = 'Description'
		AND ntk_template_fields.`common` = '1' THEN
			''
		WHEN ntk_template_fields.`name` = 'Branch'
		AND ntk_template_fields.`common` = '1'
		AND ntk_field_values.field_value > 0 THEN
			(
				SELECT
					Branch_Name
				FROM
					nts_site.branch
				WHERE
					visible = 1
				AND Branch_ID =(
					ntk_field_values.field_value
				)
			)
		WHEN ntk_template_fields.`name` = 'Room'
		AND ntk_template_fields.`common` = '1'
		AND ntk_field_values.field_value > 0 THEN
			(
				SELECT
					`name`
				FROM
					`ntk_rooms`
				WHERE
					`id` =(
						ntk_field_values.field_value
					)
			)
		ELSE
			ntk_field_values.field_value
		END
                )AS field_value
        FROM
                `ntk_field_values`
        JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
        WHERE
                `device_id` = " . $deviceId . "
        ORDER BY
                ntk_template_fields.sort_id";
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $devices = array();
        $fullDesc = array();
        while ($row = mysqli_fetch_assoc($result)) {
            $devices[$row['name']] = $row['field_value'];
            if ($row['index_field'] == 1 && !empty($row['field_value'])) {
                $devices[$row['name']] = '';
                $desc = mysqli_query($conn, "SELECT
                                    ntk_field_values.id,
                                    ntk_template_fields.`name`,
                                    ntk_field_values.`device_id`,
                                    (
                                    CASE
                                    WHEN ntk_template_fields.`name` = 'Description'
                                    AND ntk_template_fields.`common` = '1' THEN
                                            ''
                                    WHEN ntk_template_fields.`name` = 'Branch'
                                    AND ntk_template_fields.`common` = '1'
                                    AND ntk_field_values.field_value > 0 THEN
                                            (
                                                    SELECT
                                                            Branch_Name
                                                    FROM
                                                            nts_site.branch
                                                    WHERE
                                                            visible = 1
                                                    AND Branch_ID =(
                                                            ntk_field_values.field_value
                                                    )
                                            )
                                    WHEN ntk_template_fields.`name` = 'Room'
                                    AND ntk_template_fields.`common` = '1'
                                    AND ntk_field_values.field_value > 0 THEN
                                            (
                                                    SELECT
                                                            `name`
                                                    FROM
                                                            `ntk_rooms`
                                                    WHERE
                                                            `id` =(
                                                                    ntk_field_values.field_value
                                                            )
                                            )        
                                    ELSE
                                            ntk_field_values.field_value
                                    END
                            )AS field_value
                            FROM
                                    ntk_field_values
                            JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
                            WHERE
                                    device_id IN ({$row['field_value']}) AND ntk_template_fields.`description`= 1 ORDER BY ntk_template_fields.sort_id ASC");
                while ($row_desc = mysqli_fetch_assoc($desc)) {
                    $fullDesc[$row_desc['device_id']][] = $row_desc['field_value'];
                }
                $description = '';
                foreach ($fullDesc as $id1 => $columns1) {

                    foreach ($columns1 as $val1) {
                        $description .= $val1 . " ";
                    }
                    $description .= ",";
                }
                $description = substr($description, 0, strlen($description) - 1);
                $devices[$row['name']] .= $description;
                unset($fullDesc);
            }
            if ($row['description'] == '1') {
                $devices['Description'] .= " " . $row['field_value'];
            }
        }
        $content = '<table><tbody>';
        foreach ($devices as $key => $value) {
            $content .= '<tr><td><strong>' . $key . '</strong></td><td>' . $value . '</td></tr>';
        }
        $content .= '</tbody></table>';
        echo json_encode(array("content" => $content));
        break;

    case 55:
        require 'std.encryption.class.php';
        $crypt = new encryption_class;
        $password = '*x~qc';

        $crypt->setAdjustment($adj);
        $crypt->setModulus($mod);

        $adj = $crypt->getAdjustment();
        $mod = $crypt->getModulus();
        $encrypt_result = &$_SESSION['encrypt_result'];
        $decrypt_result = &$_SESSION['decrypt_result'];
        $errors = array();

        $encrypt_password = $crypt->encrypt('1234', $password, $pswdlen);
        $decrypt_result = $crypt->decrypt('1234', $encrypt_result);
        $value = $encrypt_password;
        echo $value;
        break;

    case 56:
        $fieldvalue = $_POST["nValue"];
        $id = $_POST["id"];
        $field = $_POST["colId"];

        $updateSQL = "UPDATE ntk_details SET {$field} = {$fieldvalue} WHERE  id = {$id}";
        $updateResult = mysqli_query($conn, $updateSQL) or die("SQL Error saving {$field} in {$table} table: " . mysqli_error($conn) . $updateSQL);
        if ($updateResult)
            $data['data'] = array('response' => $updateResult, 'text' => 'Successfully Saved');
        else
            $data['data'] = array('response' => $updateResult, 'text' => 'An Error Occured');

        echo json_encode($data);
        break;

    case 57:
        $SQL = "DELETE FROM ntk_details WHERE id = '" . $_GET['id'] . "'";
        if (mysqli_query($conn, $SQL)) {
            $msg = "Deleted";
        } else {
            $msg = "Error : " . mysqli_error($conn);
        }
        echo json_encode(array("response" => $msg));
        break;

    case 58:
        $resultR = mysqli_query($conn,
                "SELECT id FROM `ntk_template_fields` WHERE templ_id = " . $_POST['templ_id'] . " AND type IN('password','Password')");

        $rowR = mysqli_fetch_assoc($resultR);
        $fieldId = $rowR['id'];

        $my_passwords = randomPassword(10, 1, "lower_case,upper_case,numbers,special_symbols");

        require 'std.encryption.class.php';
        $crypt = new encryption_class;
        $password = $my_passwords[0];

        $crypt->setAdjustment($adj);
        $crypt->setModulus($mod);

        $adj = $crypt->getAdjustment();
        $mod = $crypt->getModulus();
        $encrypt_result = &$_SESSION['encrypt_result'];
        $decrypt_result = &$_SESSION['decrypt_result'];
        $errors = array();

        $encrypt_password = $crypt->encrypt('1234', $password, $pswdlen);
        $decrypt_result = $crypt->decrypt('1234', $encrypt_result);
        $value = $encrypt_password;
        $update = "UPDATE ntk_field_values SET field_value='" . $value . "' WHERE field_id = " . $fieldId . " AND templ_id = " . $_POST['templ_id'] . " AND device_id = " . $_POST['id'];
        $updateResult = mysqli_query($conn, $update) or die(mysqli_error($conn));
        if ($updateResult) {
            $data['data'] = array('response' => $updateResult, 'text' => 'Successfully Generated');
        } else {
            $data['data'] = array('response' => $updateResult, 'text' => 'An Error Occured While Generating');
        }
        echo json_encode($data);
        break;

    case 59:
        $items = filter_input(INPUT_GET, 'items', FILTER_SANITIZE_NUMBER_INT);
        $parentId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $items = $_GET['items'];
        $start_point = $_GET['start_point'];
        $end_point = $start_point + $items;

        for ($i = $start_point; $i < $end_point; $i++) {
            if (!mysqli_num_rows(mysqli_query($conn, "SELECT id FROM ntk_details WHERE parent_id = " . $parentId . " AND port_id=" . $i))) {
                $QRY_INSERT_DEVICE = "INSERT INTO ntk_details(`parent_id`,`port_id`) VALUES('{$parentId}','{$i}')";
                if (mysqli_query($conn, $QRY_INSERT_DEVICE)) {
                    $id = mysqli_insert_id($conn,);
                    $msg = "Successfully Added New Item";
                } else {
                    $msg = mysqli_error($conn);
                }
            }
        }
        break;

    case 60:

        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $value = filter_input(INPUT_GET, 'value', FILTER_SANITIZE_NUMBER_INT);

        if ($id > 0) {
            $query = "SELECT * FROM ntk_devices WHERE parent_id = " . $id;
        } else {
            $query = "SELECT * FROM ntk_devices WHERE parent_id > 0";
        }

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));

        header("Content-type:text/xml");
        echo '<?xml version = "1.0"?>' . PHP_EOL;
        echo "<complete>";
        echo("<option value='0' selected='1'></option>");
        while ($row = mysqli_fetch_assoc($result)) {
            if ($row['id'] == $value) {
                $selected = '1';
            } else {
                $selected = '0';
            }
            echo("<option value='" . $row['id'] . "' selected='" . $selected . "'><![CDATA[" . $row['name'] . "]]></option>");
        }
        echo "</complete>";
        break;

    case 61:

        $deviceId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

        $query = "
            SELECT
                        ntk_template_fields.`name`,
                        ntk_device_records.id,
                        ntk_template_fields.id field_id,
                        ntk_template_fields.common,
                        ntk_template_fields.index_field,
                        ntk_template_fields.visible,
                        ntk_template_fields.description,
                        (
                                CASE
                                WHEN ntk_template_fields.`name` = 'Description'
                                AND ntk_template_fields.`common` = '1' THEN
                                        ''
                                WHEN ntk_template_fields.`name` = 'Branch'
                                AND ntk_template_fields.`common` = '1'
                                AND ntk_field_values.field_value > 0 THEN
                                        (
                                                SELECT
                                                        Branch_Name
                                                FROM
                                                        nts_site.branch
                                                WHERE
                                                        visible = 1
                                                AND Branch_ID =(
                                                        ntk_field_values.field_value
                                                )
                                        )
                                WHEN ntk_template_fields.`name` = 'Room'
                                AND ntk_template_fields.`common` = '1'
                                AND ntk_field_values.field_value > 0 THEN
                                        (
                                                SELECT
                                                        `name`
                                                FROM
                                                        `ntk_rooms`
                                                WHERE
                                                        `id` =(
                                                                ntk_field_values.field_value
                                                        )
                                        )
                                WHEN ntk_template_fields.`name` = 'Main category'
                                AND ntk_template_fields.`common` = '0'
                                AND ntk_template_fields.`templ_id` = '362'
                                AND ntk_field_values.field_value > 0 THEN
                                        (
                                                SELECT
                                                        `name`
                                                FROM
                                                        `ntk_devices`
                                                WHERE
                                                        `id` =(
                                                                ntk_field_values.field_value
                                                        )
                                        )
                                WHEN ntk_template_fields.`name` = 'Sub category'
                                AND ntk_template_fields.`common` = '0'
                                AND ntk_template_fields.`templ_id` = '362'
                                AND ntk_field_values.field_value > 0 THEN
                                        (
                                                SELECT
                                                        `name`
                                                FROM
                                                        `ntk_devices`
                                                WHERE
                                                        `id` =(
                                                                ntk_field_values.field_value
                                                        )
                                        )        

                                ELSE
                                        ntk_field_values.field_value
                                END
                        )AS field_value
                FROM
                        ntk_device_records
                JOIN ntk_templates ON ntk_templates.device_id = ntk_device_records.device_id
                JOIN ntk_field_values ON ntk_device_records.id = ntk_field_values.device_id
                JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
                AND ntk_template_fields.templ_id = ntk_templates.id
                /*JOIN(
                        SELECT
                                device_id
                        FROM
                                ntk_field_values
                        WHERE
                                field_value = 'In Use'
                )activeDevices ON ntk_device_records.id = activeDevices.device_id*/
                WHERE
                        ntk_templates.device_id = (SELECT device_id FROM ntk_device_records WHERE id = " . $deviceId . ")
                
                AND ntk_template_fields.type <> 'password'
                ORDER BY
                        ntk_device_records.id,
                        ntk_template_fields.sort_id";

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));

        $previousDeviceId = null;
        $firstIsDone = false;
        $headers = array();
        $devices = array();
        while ($row = mysqli_fetch_assoc($result)) {
            if ($previousDeviceId !== null && $row['id'] != $previousDeviceId && !$firstIsDone) {
                $firstIsDone = true;
            } elseif (!$firstIsDone) {
                
            }
            if ($row['visible'] == '1') {
                $devices[$row['id']][$row['name']] = $row['field_value'];
                if ($row['index_field'] == 1 && !empty($row['field_value'])) {
                    $devices[$row['id']][$row['name']] = '';
                    $desc = mysqli_query($conn, "SELECT
                                    ntk_field_values.id,
                                    ntk_template_fields.`name`,
                                    ntk_field_values.`device_id`,
                                    (
                                    CASE
                                    WHEN ntk_template_fields.`name` = 'Description'
                                    AND ntk_template_fields.`common` = '1' THEN
                                            ''
                                    WHEN ntk_template_fields.`name` = 'Branch'
                                    AND ntk_template_fields.`common` = '1'
                                    AND ntk_field_values.field_value > 0 THEN
                                            (
                                                    SELECT
                                                            Branch_Name
                                                    FROM
                                                            nts_site.branch
                                                    WHERE
                                                            visible = 1
                                                    AND Branch_ID =(
                                                            ntk_field_values.field_value
                                                    )
                                            )
                                    WHEN ntk_template_fields.`name` = 'Room'
                                    AND ntk_template_fields.`common` = '1'
                                    AND ntk_field_values.field_value > 0 THEN
                                            (
                                                    SELECT
                                                            `name`
                                                    FROM
                                                            `ntk_rooms`
                                                    WHERE
                                                            `id` =(
                                                                    ntk_field_values.field_value
                                                            )
                                            )        
                                    ELSE
                                            ntk_field_values.field_value
                                    END
                            )AS field_value
                            FROM
                                    ntk_field_values
                            JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
                            WHERE
                                    device_id IN ({$row['field_value']}) AND ntk_template_fields.`description`= 1 ORDER BY ntk_template_fields.sort_id ASC");
                    while ($row_desc = mysqli_fetch_assoc($desc)) {
                        $fullDesc[$row_desc['device_id']][] = $row_desc['field_value'];
                    }
                    $description = '';
                    foreach ($fullDesc as $id1 => $columns1) {

                        foreach ($columns1 as $val1) {
                            $description .= $val1 . " ";
                        }
                        $description .= ",";
                    }
                    $description = substr($description, 0, strlen($description) - 1);
                    $devices[$row['id']][$row['name']] .= $description;
                    unset($fullDesc);
                }
                $previousDeviceId = $row['id'];
            }
            if ($row['description'] == '1') {
                $devices[$row['id']]['Description'] .= " " . $row['field_value'];
            }
        }

        $sel_header = mysqli_query($conn,
                        "SELECT
                        ntk_template_fields.id,
                        ntk_template_fields.`type`,
                        ntk_template_fields.`gridname`
                   FROM
                        ntk_template_fields
                JOIN ntk_templates ON ntk_template_fields.templ_id = ntk_templates.id
                AND visible = 1
                AND ntk_templates.device_id = (SELECT device_id FROM ntk_device_records WHERE id = " . $deviceId . ")
                AND `type` <> 'password'
                ORDER BY
                        sort_id ASC"
                ) or die(mysqli_error($conn));
        while ($row_header = mysqli_fetch_assoc($sel_header)) {

            $obj = new stdClass;
            $obj->id = $row_header['id'];
            $obj->name = $row_header['gridname'];
            $obj->type = $row_header['type'];
            $headers[$obj->id] = $obj;
        }

        header('Content-type:text/xml');
        echo '<?xml version = "1.0"?>' . PHP_EOL;
        echo '<rows>';
        echo '<head>';
        echo '<column id="counter" type="cntr" align="left" sort="int">Counter</column>';
        echo '<column id="id" type="ro" align="left" sort="str">ID</column>';

        $filters = '#numeric_filter,#numeric_filter';
        foreach ($headers as $fieldId => $fieldNames) {
            $filters .= ',#text_filter';
            if ($headers[$fieldId]->type == 'checkbox') {
                echo '<column id="' . $fieldId . '" type="ch" align="center" sort="str">' . $headers[$fieldId]->name . '</column>';
            } else {
                echo '<column id="' . $fieldId . '" type="ro" align="left" sort="str">' . $headers[$fieldId]->name . '</column>';
            }
        }
        echo '<afterInit>';
        echo '<call command="attachHeader">';
        echo '<param>' . $filters . '</param>';
        echo '</call>';
        echo '</afterInit>';

        echo '</head>';

        foreach ($devices as $id => $columns) {
            echo '<row id="' . $id . '">';
            echo '<cell></cell>';
            echo '<cell>' . $id . '</cell>';
            foreach ($headers as $val => $value) {
                echo "<cell><![CDATA[" . $columns[$headers[$val]->name] . "]]></cell>";
            }
            echo '</row>';
        }

        echo '</rows>';
        break;

    case 62:

        $deviceId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $query = "SELECT ntk_devices.id device_id,parent_id FROM ntk_devices JOIN ntk_device_records ON ntk_devices.id = ntk_device_records.device_id WHERE ntk_device_records.id = " . $deviceId;
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn) . " " . $query);
        $row = mysqli_fetch_assoc($result);
        $catId = $row["device_id"];
        $parentId = $row["parent_id"];
//        $catId = mysql_result(mysqli_query($conn, "SELECT device_id FROM ntk_device_records WHERE id = " . $deviceId), 0, 0);
        echo json_encode(array("catId" => $catId, "parentId" => $parentId));
        break;

    case 63:


        $query = "SELECT * FROM ntk_devices";
        $result = mysqli_query($conn, $query);

        while ($row = mysqli_fetch_assoc($result)) {

            $str = '';
//            devicesGridUpdateJson($row['id']);
//            devicesGridUpdateXML($row['id']);
        }

        break;

    case 64:

        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $filename = 'xml/category_' . $id . '/assets.xml';
        if (file_exists($filename)) {
            echo json_encode(array("mtime" => filemtime($filename)));
        }
        break;

    case 65:

        header('Content-type:text/xml');
        print '<?xml version = "1.0"?>' . PHP_EOL;
        print('<menu id="0" >');
        print('<item text="Add Child"  img="new.gif"  id="add"/>');
        print('<item text="Delete Item"  img="deleteall.png"  id="delete"/>');
        print('</menu>');
        break;

    case 66:

        $templateId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $itemId = filter_input(INPUT_GET, 'item_id', FILTER_SANITIZE_NUMBER_INT);
        $id = filter_input(INPUT_GET, 'cat_id', FILTER_SANITIZE_NUMBER_INT);

        $insertTemplateField = "INSERT INTO ntk_template_fields(`sort_id`,`templ_id`,parent_id) SELECT IF((MAX(sort_id)>0),MAX(sort_id)+1,1)sort,'" . $templateId . "'," . $itemId . " FROM ntk_template_fields WHERE templ_id = " . $templateId . " AND parent_id =" . $itemId;

        $result = mysqli_query($conn, $insertTemplateField) or die(mysqli_error($conn));

        if ($result) {
            $fieldId = mysqli_insert_id($conn,);
//            createDevicesGridXML($id);
//            devicesGridUpdateXML($id);
//            clearstatcache();
            $data['data'] = array('success' => $result, 'id' => $fieldId, 'text' => 'Successfully Saved');
        } else {
            $data['data'] = array('success' => $result, 'text' => 'An Error Occured While Saving');
        }

        echo json_encode($data);

        break;

    case 67:

        $rowId = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $id = filter_input(INPUT_GET, 'cat_id', FILTER_SANITIZE_NUMBER_INT);
// Get details of selected record.
        $sql = "SELECT * FROM ntk_template_fields WHERE id = " . $rowId;
        $result = mysqli_query($conn, $sql) or die(mysqli_error($conn));
        $row = mysqli_fetch_assoc($result);
        $sortorder = $row['sort_id'];
        $parent = $row['parent_id'];
        $templ_id = $row['templ_id'];

        $delete = "DELETE FROM ntk_template_fields WHERE id = " . $rowId;
        $deleteResult = mysqli_query($conn, $delete) or die(mysqli_error($conn));
        if ($deleteResult) {
            if ($sortorder > 1) {
                // Update remaining records.
                $sql = "UPDATE ntk_template_fields SET sort_id = sort_id-1 WHERE templ_id = " . $templ_id . " AND parent_id=" . $parent . " AND sort_id > $sortorder ";
                $updated = mysqli_query($conn, $sql) or die(mysqli_error($conn));
            }
//            createDevicesGridXML($id);
//            devicesGridUpdateXML($id);
//            clearstatcache();
            $data['data'] = array('response' => $deleteResult, 'text' => 'Successfully Deleted');
        } else {
            $data['data'] = array('response' => $deleteResult, 'text' => 'An Error Occured While Deleting');
        }
        echo json_encode($data);

        break;

    case 68:

        $id = filter_input(INPUT_GET, 'cat_id', FILTER_SANITIZE_NUMBER_INT);

        $parentid = $_GET['parent_id'];
        $parentfield = 'parent_id';
        $itemid = $_GET['itemId'];
        $itemidfield = 'id';
        $sortid = $_GET['sortId'];
        $sortfield = 'sort_id';
        $table = 'ntk_template_fields';
        $direction = $_GET['direction'];

        echo json_encode(moveItemUpDownGrid($parentid, $parentfield, $itemid, $itemidfield, $sortid, $sortfield, $table, $direction));

//        createDevicesGridXML($id);
//        devicesGridUpdateXML($id);
//        clearstatcache();
        break;

    case 69:

        header("Content-type:text/xml");
        print('<?xml version="1.0" encoding="UTF-8"?>');
        echo "<items>";

        $query = "SELECT * FROM ntk_devices ORDER BY parent_id = 0 DESC,id";
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $objects = array();
        $roots = array();
        while ($row = mysqli_fetch_assoc($result)) {
            if (!isset($objects[$row['id']])) {
                $objects[$row['id']] = new stdClass;
            }

            $obj = $objects[$row['id']];
            $obj->id = $row['id'];
            $obj->name = $row['name'];

            if ($row['parent_id'] == 0) {
                $roots[] = $obj;
            } else {
                $subcat[] = $obj;
            }
        }
        $query = "
            SELECT
                    ntk_template_fields.*
            FROM
                    ntk_template_fields
            JOIN ntk_templates ON ntk_templates.id = ntk_template_fields.templ_id
            WHERE
                    ntk_templates.device_id = " . $_GET['id'] . "
            AND ntk_template_fields.visible_in_form = 1
            ORDER BY
                    ntk_template_fields.sort_id ASC";
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
        $subfields = array();
        while ($row = mysqli_fetch_assoc($result)) {
            if ($row['parent_id'] > 0) {
                $subfields[] = $row['id'];
            }
        }

        if (count($subfields) > 0) {
            templateFieldsFormXML($_GET['id']);
        } else {
            $resQry = mysqli_query($conn, "SELECT * FROM ntk_templates WHERE device_id = " . $_GET['id']) or die(mysqli_error($conn));
            $rowQry = mysqli_fetch_assoc($resQry);
            if ($rowQry["id"]) {
                echo '<item type="settings" position="label-left"  labelWidth="90" inputWidth="230" offsetTop="5" offsetLeft="10"/>';

                $selTemplFields = mysqli_query($conn, "SELECT * FROM ntk_template_fields WHERE templ_id = " . $rowQry["id"] . " AND common = 1 AND visible_in_form = 1 ORDER BY sort_id ASC") or die(mysqli_error($conn));
                while ($resTemplFields = mysqli_fetch_assoc($selTemplFields)) {
                    $type = $resTemplFields['type'];
                    $indexField = $resTemplFields['index_field'];
                    $indexId = $resTemplFields['index_id'];
                    $info = false;
                    $readonly = false;
                    $style = '';
                    $rows = '';
                    $className = 'formbox';
                    if (!$type || $type == 'crm' || $type == 'password' || $type == 'document') {
                        $type = 'input';
                    }
                    if ($type == 'multiline') {
                        $type = 'input';
                        if ($resTemplFields['value'] <= 10) {
                            $rows = 'rows="' . $resTemplFields['value'] . '"';
                        } else {
                            $rows = 'rows="10"';
                        }
                    }
                    if ($resTemplFields['name'] == 'Date In' || $resTemplFields['name'] == 'Date Out') {
                        $type = 'calendar';
                    }
                    if ($indexId > 0) {

                        if ($indexField > 0) {
                            $readonly = true;
                            $style = 'background-color:#e6e6e6;';
                        }
                        $info = true;
                        //$className = 'formbox_readonly';
                        //$type = 'multiselect';
                    }
                    if ($resTemplFields['name'] == 'Description') {
                        $readonly = true;
                        $style = 'background-color:#e6e6e6;';
                        //$className = 'formbox_readonly';
                    }
                    if ($type != 'tinymce') {
                        echo ("<item type='" . $type . "' inputWidth='" . $resTemplFields['width'] . "' name='form_" . $resTemplFields['id'] . "' $rows label='" . $resTemplFields['name'] . "' info='" . $info . "' readonly ='" . $readonly . "' className='" . $className . "' style='" . $style . "'>");

                        if ($resTemplFields['name'] == 'Status') {
                            $statusQuery = "SELECT t.id,t.name opt_name FROM ntk_main_fields_options t JOIN ntk_main_fields m on m.id = t.field_id WHERE m.sort_id = 5 ORDER BY t.sort_id ASC";
                            $statusResult = mysqli_query($conn, $statusQuery);
                            while ($rowstatus = mysqli_fetch_array($statusResult)) {
                                $status_name = mysqli_real_escape_string($conn, $rowstatus["opt_name"]);
                                echo("<option text='" . $status_name . "' value='" . $status_name . "'/>");
                            }
                        }
                        if ($resTemplFields['name'] == 'Branch') {
                            $branchQuery = "SELECT Branch_ID, Branch_Name FROM nts_site.branch WHERE visible = 1 and Branch_ID > 0 ORDER BY Branch_ID ASC";
                            $branchResult = mysqli_query($conn, $branchQuery);
                            while ($rows = mysqli_fetch_array($branchResult)) {
                                $this_branch_id = $rows["Branch_ID"];
                                $branch_name = mysqli_real_escape_string($conn, $rows["Branch_Name"]);
                                echo("<option text='" . $branch_name . "' value='" . $this_branch_id . "'/>");
                            }
                        }
                        echo ("</item>");
                    }
                }

                echo ("<item type='newcolumn'  offset='20'/>");

                $selTemplFields1 = mysqli_query($conn, "SELECT * FROM ntk_template_fields WHERE templ_id = " . $rowQry["id"] . " AND common = 0 AND visible_in_form = 1 ORDER BY sort_id ASC") or die(mysqli_error($conn));
                $numberOfFields = mysqli_num_rows($selTemplFields1);

                $cntr = 1;
                if ($numberOfFields > 0) {
                    while ($resTemplFields1 = mysqli_fetch_assoc($selTemplFields1)) {
                        $type = $resTemplFields1['type'];
                        $indexField = $resTemplFields1['index_field'];
                        $indexId = $resTemplFields1['index_id'];
                        $info = false;
                        $readonly = false;
                        $style = '';
                        $rows = '';
                        $className = 'formbox';
                        if (!$type || $type == 'password' || $type == 'crm' || $type == 'document') {
                            $type = 'input';
                        }

                        if ($type == 'multiline') {
                            $type = 'input';
                            if ($resTemplFields1['value'] <= 10) {
                                $rows = 'rows="' . $resTemplFields1['value'] . '"';
                            } else {
                                $rows = 'rows="10"';
                            }
                        }

                        $selTemplOptions = mysqli_query($conn, "SELECT * FROM ntk_fields_options WHERE field_id = " . $resTemplFields1['id'] . " AND visible = 1") or die(mysqli_error($conn));
                        if ((mysqli_num_rows($selTemplOptions)) && $indexField == 0) {
                            $type = 'combo';
                        }
                        if ($indexId > 0) {

                            if ($indexField > 0) {
                                $readonly = true;
                                $style = 'background-color:#e6e6e6;';
                            }
                            $info = true;
                            //$className = 'formbox_readonly';
                            //$type = 'multiselect';
                        }
                        echo ("<item type='" . $type . "' inputWidth='" . $resTemplFields1['width'] . "' name='form_" . $resTemplFields1['id'] . "' label='" . $resTemplFields1['name'] . "' info='" . $info . "' readonly ='" . $readonly . "' className='" . $className . "' style='" . $style . "'>");
                        if ($resTemplFields1['name'] == 'Main category' && $resTemplFields1['templ_id'] == '362') {
                            echo("<option text='' value='0'/>");
                            foreach ($roots as $obj) {
                                echo("<option text='" . $obj->name . "' value='" . $obj->id . "'/>");
                            }
                        } else if ($resTemplFields1['name'] == 'Sub category' && $resTemplFields1['templ_id'] == '362') {
                            echo("<option text='' value='0'/>");
                            foreach ($subcat as $obj) {
                                echo("<option text='" . $obj->name . "' value='" . $obj->id . "'/>");
                            }
                        } else {
                            while ($resTemplOptions = mysqli_fetch_assoc($selTemplOptions)) {
                                echo("<option text='" . $resTemplOptions['name'] . "' value='" . $resTemplOptions['name'] . "'/>");
                            }
                        }
                        echo "</item>";
                        if ($numberOfFields > 10 && (round($numberOfFields / 2) == $cntr)) {
                            echo ("<item type='newcolumn'  offset='20'/>");
                        }
                        ++$cntr;
                    }
                }
            }
        }


        echo "</items>";
        break;

    case 70:

        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

        $result = mysqli_query($conn, "SELECT (max(sort_id)+1) sort_id FROM ntk_devices WHERE parent_id = 0");
        $row = mysqli_fetch_assoc($result);
        $sortId = $row['sort_id'];

        $insertRootItem = "UPDATE ntk_devices SET `sort_id` = $sortId,`parent_id`= 0 WHERE id = " . $id;
        $insertRootItemResult = mysqli_query($conn, $insertRootItem) or die(mysqli_error($conn));
        if ($insertRootItemResult) {
            $data['data'] = array('response' => $insertRootItemResult, 'text' => 'Successfully Moved', "newId" => $id);
        } else {
            $data['data'] = array('response' => $insertRootItemResult, 'text' => 'An Error Occured While Moving');
        }
        echo json_encode($data);

        break;

    case 71:
//        $fieldName = explode("_", $_POST['id']);
//        $field_id = $fieldName[1];
        $field_id = $_POST['id'];
        $content = $_POST["procedure"];
//$content = mysqli_real_escape_string($conn, $_POST["procedure"]);
        $SQL = "UPDATE ntk_template_fields SET field_procedure = '{$content}' WHERE id = {$field_id}";
        if (mysqli_query($conn, $SQL)) {
            $msg = "Successfully saved!";
        } else {
            $msg = "Error : " . mysqli_error($conn);
        }
        echo json_encode(array("message" => $msg));
        break;

    case 72:
//        $fieldName = explode("_", $_GET['name']);
//        $field_id = $fieldName[1];
        $field_id = $_GET['id'];
        $selProcedure = mysqli_query($conn, "SELECT field_procedure FROM ntk_template_fields WHERE id = '{$field_id}'") or die(mysqli_error($conn));
        $row = mysqli_fetch_assoc($selProcedure);
        echo json_encode(array("content" => $row["field_procedure"]));
        break;

    case 73:
        $query = "SELECT * FROM greenhouse.`dbasset_to_unrealasset` ORDER BY dbAssetID";
        $result = mysqli_query($conn, $query) or die(mysqli_error($conn));

        while ($row = mysqli_fetch_assoc($result)) {
            $insert = "
            INSERT INTO ntk_field_values(
                    ntk_field_values.field_id,
                    ntk_field_values.templ_id,
                    ntk_field_values.device_id,
                    ntk_field_values.field_value
            )SELECT
                    ntk_template_fields.id field_id,
                    ntk_template_fields.templ_id,
                    '" . $row['dbAssetID'] . "',
                    '" . $row['unrealAssetID'] . "'
            FROM
                    ntk_template_fields
            WHERE
                    templ_id =(
                            SELECT
                                    ntk_field_values.templ_id
                            FROM
                                    ntk_field_values
                            WHERE
                                    device_id = " . $row['dbAssetID'] . "
                            LIMIT 1
                    )
            AND common = 1
            AND ntk_template_fields.`name` = 'Unreal AssetID' ON DUPLICATE KEY UPDATE field_value='" . $row['unrealAssetID'] . "'";
            mysqli_query($conn, $insert) or die(mysqli_error($conn));
        }
        break;

    case 74:

        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);

        createCommonTestFormFields($id);
        break;

    case 75:
        header('Content-type:text/xml');
        echo '<?xml version="1.0"?>' . PHP_EOL;
        echo '<rows>';
        treeDirSystemEntry();
        echo '</rows>';
        break;

    case 76:

        $srcId = filter_input(INPUT_POST, 'srcId', FILTER_SANITIZE_NUMBER_INT);
        $destId = filter_input(INPUT_POST, 'destId', FILTER_SANITIZE_NUMBER_INT);

        copyFieldOptions($srcId, $destId);

        $data['data'] = array('success' => true, 'text' => "Options successflly copied");

        echo json_encode($data);
        break;

    case 77:

        $cat_id = filter_input(INPUT_GET, 'cat_id', FILTER_SANITIZE_NUMBER_INT);
        $id = filter_input(INPUT_GET, 'id', FILTER_SANITIZE_NUMBER_INT);
        $templ_id = filter_input(INPUT_GET, 'templ_id', FILTER_SANITIZE_NUMBER_INT);

        $insert = array();
        $fields = array();
        $nodes = array();

        $projectId = 0;
        $unrealAssetId = 0;
        $assetPatternId = 0;
        $x = '';
        $y = '';
        $z = '';

        foreach ($_POST as $key => $value) {
            $fieldName = explode("_", $key);
            $fieldId = $fieldName[1];
            if ($fieldName[0] !== 'combo' && $fieldId > 0) {
                $fields[] = $fieldId;
            }
        }
        $fieldList = implode(',', $fields);

        $description_array = array();

        $query = "SELECT * FROM `ntk_template_fields` WHERE id IN(" . $fieldList . ")";

        $result = mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);
        while ($row = mysqli_fetch_assoc($result)) {
            $obj = new stdClass;
            $obj->id = $row['id'];
            $obj->name = $row['name'];
            $obj->common = $row['common'];
            $obj->index_field = $row['index_field'];
            $obj->index_id = $row['index_id'];
            $obj->type = $row['type'];
            $obj->description = $row['description'];
            $nodes[$obj->id] = $obj;
        }




        foreach ($_POST as $key => $value) {


            $fieldName = explode("_", $key);
            $fieldId = $fieldName[1];

            if ($nodes[$fieldId]->type == 'password' || $nodes[$fieldId]->type == 'Password') {
                require 'std.encryption.class.php';
                $crypt = new encryption_class;
                $password = $value;

                $crypt->setAdjustment($adj);
                $crypt->setModulus($mod);

                $adj = $crypt->getAdjustment();
                $mod = $crypt->getModulus();
                $encrypt_result = &$_SESSION['encrypt_result'];
                $decrypt_result = &$_SESSION['decrypt_result'];
                $errors = array();

                $encrypt_password = $crypt->encrypt('1234', $password, $pswdlen);
                $decrypt_result = $crypt->decrypt('1234', $encrypt_result);
                $value = $encrypt_password;
            } else {
                $value = mysqli_real_escape_string($conn, $value);
            }

            if ($nodes[$fieldId]->description > 0) {
                $description_array[$fieldId] = array('field' => $fieldId, 'index_field' => $nodes[$fieldId]->index_field, 'index_id' => $nodes[$fieldId]->index_id, 'field_value' => $value);
            }

            if ($nodes[$fieldId]->name == 'Unreal AssetID' && $nodes[$fieldId]->common > 0 && $value > 0) {
                $unrealAssetId = $value;
            }

            if ($nodes[$fieldId]->type == 'project_id' && $value > 0) {
                $projectId = $value;
            }

            if (!($nodes[$fieldId]->name == 'Description' && $nodes[$fieldId]->common == '1')) {

                if ($fieldName[0] !== 'combo' && $fieldId > 0) {
                    $insert[] = "(" . $id . "," . $templ_id . "," . $fieldId . ",'" . $value . "',NOW())";
                }
            }

            if ($nodes[$fieldId]->name == 'X-pos' && $nodes[$fieldId]->common > 0) {
                $x = $value;
            }

            if ($nodes[$fieldId]->name == 'Y-pos' && $nodes[$fieldId]->common > 0) {
                $y = $value;
            }

            if ($nodes[$fieldId]->name == 'Z-pos' && $nodes[$fieldId]->common > 0) {
                if ($value > 0) {
                    $z = $value;
                } else {
                    $z = '0.0';
                }
            }

            if ($nodes[$fieldId]->name == 'Angle' && $nodes[$fieldId]->common > 0) {
                if ($value > 0) {
                    $angle = $value;
                } else {
                    $angle = '0.0';
                }
            }
        }

//print_r($insert);exit;
        if (count($insert) > 0) {

            $query = "INSERT INTO ntk_field_values(`device_id`,`templ_id`,`field_id`,`field_value`,`last_changed`) VALUES " . implode(',', $insert) . " ON DUPLICATE KEY UPDATE field_value=VALUES(field_value),last_changed=VALUES(last_changed)";

            $updateResult = mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);

            if ($updateResult) {

                if ($unrealAssetId > 0 && $projectId > 0) {

                    //generate asset pattern description
                    $final_description = '';
                    foreach ($description_array as $key => $value) {

                        if ($value['index_field'] > 0 && $value['index_id']) {
                            $description = explode(']', $value['field_value']);
                            $final_description .= " " . $description[1] . ",";
                        } else {
                            $final_description .= " " . $value['field_value'] . ",";
                        }
                    }

                    if ($final_description) {
                        $final_description = substr($final_description, 0, strlen($final_description) - 1);
                        $final_description = substr($final_description, 1, strlen($final_description));
                    }

                    //connect db_asset to unreal_asset
                    $insertAsset = "INSERT INTO greenhouse.dbasset_to_unrealasset(`dbAssetID`,`unrealAssetID`) VALUES (" . $id . "," . $unrealAssetId . ") ON DUPLICATE KEY UPDATE unrealAssetID=VALUES(unrealAssetID)";
                    mysqli_query($conn, $insertAsset) or die(mysqli_error($conn) . $insertAsset);

                    $query = "SELECT assetid_to_assetpattern.PatternID,staticmeshs.X_Size,staticmeshs.Y_Size FROM greenhouse.assetid_to_assetpattern JOIN greenhouse.design_pattern ON design_pattern.PatternID = assetid_to_assetpattern.PatternID JOIN greenhouse.staticmeshs ON staticmeshs.AssetID = design_pattern.AssetID WHERE assetid_to_assetpattern.dbAssetID = " . $id;
                    $result = mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);
                    $row_count = mysqli_num_rows($result);

                    $SpawnRotation = "P=0.0, R=0.0, Y=$angle, S=0";
                    if ($row_count > 0) {

                        //update asset pattern for the db asset
                        $row = mysqli_fetch_assoc($result);
                        $assetPatternId = $row['PatternID'];
                        $XSize = $row['X_Size'];
                        $YSize = $row['Y_Size'];

                        $XUnreal = $x + (0.5 * $XSize);
                        $YUnreal = $y + (0.5 * $YSize);
                        $SpawnPosition = "X=$XUnreal,Y=$YUnreal,Z=$z";

                        $update_desc = "UPDATE greenhouse.design_pattern SET Description='" . $final_description . "',X_SmartDraw='" . $x . "',Y_SmartDraw='" . $y . "',SpawnPosition='" . $SpawnPosition . "',SpawnRotation='" . $SpawnRotation . "' WHERE PatternID = " . $assetPatternId;
                        mysqli_query($conn, $update_desc) or die(mysqli_error($conn));
                    } else {

                        $query = "SELECT staticmeshs.X_Size,staticmeshs.Y_Size FROM greenhouse.staticmeshs WHERE AssetID =" . $unrealAssetId;
                        $result = mysqli_query($conn, $query) or die(mysqli_error($conn) . $query);
                        $row = mysqli_fetch_assoc($result);
                        $XSize = $row['X_Size'];
                        $YSize = $row['Y_Size'];

                        $XUnreal = $x + (0.5 * $XSize);
                        $YUnreal = $y + (0.5 * $YSize);
                        $SpawnPosition = "X=$XUnreal,Y=$YUnreal,Z=$z";

                        //create asset pattern for the db asset
                        $insertPattern = "INSERT INTO greenhouse.design_pattern SET AssetID = " . $unrealAssetId . ",ProjectID=" . $projectId . ",X_SmartDraw='" . $x . "',Y_SmartDraw='" . $y . "',Description='" . $final_description . "',SpawnPosition='" . $SpawnPosition . "',SpawnRotation='" . $SpawnRotation . "'";
                        $resultPattern = mysqli_query($conn, $insertPattern) or die(mysqli_error($conn) . $insertPattern);

                        if ($resultPattern) {
                            $assetPatternId = mysqli_insert_id($conn,);

                            $update = "INSERT INTO greenhouse.assetid_to_assetpattern (`dbAssetID`,`PatternID`) VALUES (" . $id . "," . $assetPatternId . ") ON DUPLICATE KEY UPDATE PatternID=VALUES(PatternID)";
                            $updateResult = mysqli_query($conn, $update) or die(mysqli_error($conn) . $update);
                        }
                    }
                }

//                createDevicesGridXML($cat_id);
//                devicesGridUpdateXML($cat_id);
//                clearstatcache();
                $data['data'] = array('success' => $updateResult, 'text' => 'Successfully Added');
            } else {
                $data['data'] = array('success' => $updateResult, 'text' => 'An Error Occured');
            }
        }


//        } else {
//            $data['data'] = array('success' => false, 'text' => 'You Dont Have Permissions to Update This Record');
//        }

        echo json_encode($data);
        break;
}

function random_password($length = 6) {
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    $password = substr(str_shuffle($chars), 0, $length);
    return $password;
}

function randomPassword($length, $count, $characters) {

// $length - the length of the generated password
// $count - number of passwords to be generated
// $characters - types of characters to be used in the password
// define variables used within the function    
    $symbols = array();
    $passwords = array();
    $used_symbols = '';
    $pass = '';

// an array of different character types    
    $symbols["lower_case"] = 'abcdefghijklmnopqrstuvwxyz';
    $symbols["upper_case"] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $symbols["numbers"] = '1234567890';
    $symbols["special_symbols"] = '!?~@#-_+<>[]{}';

    $characters = split(",", $characters); // get characters types to be used for the passsword
    foreach ($characters as $key => $value) {
        $used_symbols .= $symbols[$value]; // build a string with all characters
    }
    $symbols_length = strlen($used_symbols) - 1; //strlen starts from 0 so to get number of characters deduct 1

    for ($p = 0; $p < $count; $p++) {
        $pass = '';
        for ($i = 0; $i < $length; $i++) {
            $n = rand(0, $symbols_length); // get a random character from the string with all characters
            $pass .= $used_symbols[$n]; // add the character to the password string
        }
        $passwords[] = $pass;
    }

    return $passwords; // return the generated password
}

function treeDir() {
    global $conn;

    $result = mysqli_query($conn, "
        SELECT
            ntk_devices.id,
            ntk_devices.name,
            ntk_devices.sort_id,
            ntk_devices.parent_id,
            ntk_templates.id template_id
        FROM
            ntk_devices
        JOIN ntk_templates ON ntk_templates.device_id = ntk_devices.id        
        ORDER BY
            parent_id = 0 DESC, ntk_devices.id 
                ");

    $objects = array();
    $roots = array();
    while ($row = mysqli_fetch_assoc($result)) {
        if (!isset($objects[$row['id']])) {
            $objects[$row['id']] = new stdClass;
            $objects[$row['id']]->children = array();
        }

        $obj = $objects[$row['id']];
        $obj->id = $row['id'];
        $obj->name = $row['name'];
        $obj->sort_id = $row['sort_id'];
        $obj->template_id = $row['template_id'];

        if ($row['parent_id'] == 0) {
            $roots[] = $obj;
        } else {
            if (!isset($objects[$row['parent_id']])) {
                $objects[$row['parent_id']] = new stdClass;
                $objects[$row['parent_id']]->children = array();
            }

            $objects[$row['parent_id']]->children[$row['id']] = $obj;
        }
    }

    foreach ($roots as $obj) {
        printXML($obj, true);
    }
}

function printXML(stdClass $obj, $isRoot = false) {
    echo '<row id="' . $obj->id . '">';
    if (!$isRoot && count($obj->children) == 0) {
        echo '<cell>' . $obj->name . '</cell>';
    } else {
        echo '<cell image="folder.gif">' . $obj->name . '</cell>';
    }
    echo '<cell>' . $obj->template_id . '</cell>';
    echo '<cell>' . $obj->sort_id . '</cell>';

    foreach ($obj->children as $child) {
        printXML($child);
    }

    echo '</row>';
}

function optionsTreeDir($id) {

    global $conn;

    $result = mysqli_query($conn, "
        SELECT * FROM ntk_fields_options WHERE field_id = " . $id . " ORDER BY parent_id = 0 DESC,sort_id
                ");

    $objects = array();
    $roots = array();
    while ($row = mysqli_fetch_assoc($result)) {
        if (!isset($objects[$row['id']])) {
            $objects[$row['id']] = new stdClass;
            $objects[$row['id']]->children = array();
        }

        $obj = $objects[$row['id']];
        $obj->id = $row['id'];
        $obj->name = $row['name'];
        $obj->sort_id = $row['sort_id'];
        $obj->visible = $row['visible'];
        $obj->default_value = $row['default_value'];

        if ($row['parent_id'] == 0) {
            $roots[] = $obj;
        } else {
            if (!isset($object[$row['parent_id']])) {
                $object[$row['parent_id']] = new stdClass;
                $object[$row['parent_id']]->children = array();
            }

            $objects[$row['parent_id']]->children[$row['id']] = $obj;
        }
    }

    foreach ($roots as $obj) {
        printOptionsXML($obj, true);
    }
}

function printOptionsXML(stdClass $obj, $isRoot = false) {
    echo '<row id="' . $obj->id . '">';
    echo '<cell></cell>';
    echo '<cell>' . $obj->id . '</cell>';
    echo '<cell>' . $obj->sort_id . '</cell>';
    if (count($obj->children) == 0) {
        echo '<cell>' . $obj->name . '</cell>';
    } else {
        echo '<cell image="folder.gif">' . $obj->name . '</cell>';
    }
    echo '<cell>' . $obj->visible . '</cell>';
    echo '<cell>' . $obj->default_value . '</cell>';

    foreach ($obj->children as $child) {
        printOptionsXML($child);
    }

    echo '</row>';
}

function treeDir1($loggedUserId) {

    global $conn;

    $result = mysqli_query($conn, "
              SELECT
                        ntk_devices.*, priviledges.read_privilege,
                        priviledges.write_privilege,
                        priviledges.create_privilege,
                        priviledges.delete_privilege
                FROM
                        ntk_devices
                JOIN user_management.program_user_privileges priviledges ON ntk_devices.id = priviledges.item_id
                AND priviledges.read_privilege = 1
                AND priviledges.program_id = 1
                AND priviledges.user_id = " . $loggedUserId . "
                AND priviledges.item_level > 0
                ORDER BY
                        parent_id = 0 DESC,
                        id
                ");

    $objects = array();
    $roots = array();
    while ($row = mysqli_fetch_assoc($result)) {
        if (!isset($objects[$row['id']])) {
            $objects[$row['id']] = new stdClass;
            $objects[$row['id']]->children = array();
        }

        $obj = $objects[$row['id']];
        $obj->id = $row['id'];
        $obj->name = $row['name'];
        $obj->sort_id = $row['sort_id'];
        $obj->read = $row['read_privilege'];
        $obj->write = $row['write_privilege'];
        $obj->create = $row['create_privilege'];
        $obj->delete = $row['delete_privilege'];

        if ($row['parent_id'] == 0) {
            $roots[] = $obj;
        } else {
            if (!isset($object[$row['parent_id']])) {
                $object[$row['parent_id']] = new stdClass;
                $object[$row['parent_id']]->children = array();
            }

            $objects[$row['parent_id']]->children[$row['id']] = $obj;
        }
    }

    foreach ($roots as $obj) {
        printXML1($obj, true);
    }
}

function printXML1(stdClass $obj, $isRoot = false) {
    echo '<row id="' . $obj->id . '">';
    if (!$isRoot && count($obj->children) == 0) {
        echo '<cell>' . $obj->name . '</cell>';
    } else {
        echo '<cell image="folder.gif">' . $obj->name . '</cell>';
    }
    echo '<cell>' . $obj->sort_id . '</cell>';
    echo '<userdata name = "create">' . $obj->create . '</userdata>';
    echo '<userdata name = "write">' . $obj->write . '</userdata>';
    echo '<userdata name = "delete">' . $obj->delete . '</userdata>';

    foreach ($obj->children as $child) {
        printXML1($child);
    }

    echo '</row>';
}

function xmlEscape($string) {
    return str_replace(array('&', '<', '>', '\'', '"'), array('&amp;', '&lt;', '&gt;', '&apos;', '&quot;', ''), $string);
}

function updateSQL($table, $field, $fieldvalue, $id, $idfield, $colType) {

    global $conn;

    $updateSQL = "UPDATE {$table} SET {$field} =";

    if ($colType == "int") {
        $updateSQL .= $fieldvalue ?: 'null';
    } else {
        $updateSQL .= "'{$fieldvalue}'";
    }
    $updateSQL .= " WHERE  {$idfield} = '{$id}'";
//$updateSQL .= $condition;

    $updateResult = mysqli_query($conn, $updateSQL) or die("SQL Error saving {$field} in {$table} table: " . mysqli_error($conn) . $updateSQL);

    return $updateResult;
}

function moveItemUpDownGrid($parentid, $parentfield, $itemid, $itemidfield, $sortid, $sortfield, $table, $direction) {

    global $conn;

    if ($direction == "up") {

        $minmax = getMinMaxSortID($parentid, $parentfield, $sortid, $sortfield, $table, "MIN");

        if ($sortid > $minmax) {

            $xsql = "UPDATE {$table} SET {$sortfield} = {$sortid} WHERE {$sortfield} = {$sortid}-1";
            if (!empty($parentid)) {
                $xsql .= " AND {$parentfield} = {$parentid}";
            }
            $xres = mysqli_query($conn, $xsql) or die(mysqli_error($conn) . " " . $xsql);

            $sql = "UPDATE {$table} SET {$sortfield} = {$sortid}-1 WHERE {$itemidfield} = {$itemid}";
            if (!empty($parentid)) {
                $sql .= " AND {$parentfield} = {$parentid}";
            }
            $res = mysqli_query($conn, $sql) or die(mysqli_error($conn) . " " . $sql);
        }
    } else if ($direction == "down") {

        $minmax = getMinMaxSortID($parentid, $parentfield, $sortid, $sortfield, $table, "MAX");

        if ($sortid < $minmax) {

            $xsql = "UPDATE {$table} SET {$sortfield} = {$sortid} WHERE {$sortfield} = {$sortid}+1";
            if (!empty($parentid)) {
                $xsql .= " AND {$parentfield} = {$parentid}";
            }
            $xres = mysqli_query($conn, $xsql) or die(mysqli_error($conn) . " " . $xsql);

            $sql = "UPDATE {$table} SET {$sortfield} = {$sortid}+1 WHERE {$itemidfield} = {$itemid}";
            if (!empty($parentid)) {
                $sql .= " AND {$parentfield} = {$parentid}";
            }
            $res = mysqli_query($conn, $sql) or die(mysqli_error($conn) . " " . $sql);
        }
    }

    $data['data'] = array('success' => true, 'u' => $minmax, 'x' => $xsql);

    return $data;
}

function getMinMaxSortID($parentid, $parentfield, $sortid, $sortfield, $table, $minmax) {

    global $conn;

    $sql = "SELECT {$minmax}({$sortfield}) AS minmax FROM {$table} WHERE {$sortid} > 0";
    if (!empty($parentid)) {
        $sql .= " AND {$parentfield} = {$parentid}";
    }
    $res = mysqli_query($conn, $sql) or die(mysqli_error($conn) . " " . $sql);
    $row = mysqli_fetch_array($res);

    return $row["minmax"];
}

function getChildObjects($parent, $deviceId) {

    global $conn;

    $query = "SELECT
                        ntk_device_records.id,
                        ntk_devices.`name` category,
                        ntk_template_fields.`name`,
                        ntk_template_fields.description,
                        (
                                CASE
                                WHEN ntk_template_fields.`name` = 'Description'
                                AND ntk_template_fields.`common` = '1' THEN
                                        ''
                                WHEN ntk_template_fields.`name` = 'Branch'
                                    AND ntk_template_fields.`common` = '1'
                                    AND ntk_field_values.field_value > 0 THEN
                                            (
                                                    SELECT
                                                            Branch_Name
                                                    FROM
                                                            nts_site.branch
                                                    WHERE
                                                            visible = 1
                                                    AND Branch_ID =(
                                                            ntk_field_values.field_value
                                                    )
                                            )
                                    WHEN ntk_template_fields.`name` = 'Room'
                                    AND ntk_template_fields.`common` = '1'
                                    AND ntk_field_values.field_value > 0 THEN
                                            (
                                                    SELECT
                                                            `name`
                                                    FROM
                                                            `ntk_rooms`
                                                    WHERE
                                                            `id` =(
                                                                    ntk_field_values.field_value
                                                            )
                                            )        
                                ELSE
                                        ntk_field_values.field_value
                                END
                        )AS field_value
                FROM
                        ntk_device_records
                LEFT JOIN ntk_devices ON ntk_device_records.device_id = ntk_devices.id
                JOIN ntk_field_values ON ntk_device_records.id = ntk_field_values.device_id
                LEFT JOIN ntk_template_fields ON ntk_field_values.field_id = ntk_template_fields.id
                WHERE
                        ntk_device_records.id IN(
                                SELECT
                                        device_id
                                FROM
                                        ntk_template_fields
                                JOIN ntk_field_values ON ntk_template_fields.id = ntk_field_values.field_id
                                WHERE
                                        ntk_template_fields.`index_field` = '1'
                                AND ntk_field_values.field_value = '{$parent}'
                        )
                ORDER BY
                        ntk_device_records.id,
                        ntk_template_fields.sort_id";
    $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
    $devices = array();
    while ($row = mysqli_fetch_assoc($result)) {
        $devices[$row['id']][$row['category']][$row['name']] = $row['field_value'];
        if ($row['description'] == '1') {
            $devices[$row['id']][$row['category']]['Description'] .= " " . $row['field_value'];
        }
    }

    $query_children = "SELECT
                                device_id
                        FROM
                                ntk_template_fields
                        JOIN ntk_field_values ON ntk_template_fields.id = ntk_field_values.field_id
                        WHERE
                                ntk_template_fields.`index_field` = '1'
                        AND ntk_field_values.field_value = '{$deviceId}'";
    $res_children = mysqli_query($conn, $query_children) or die(mysqli_error($conn));
    $childDevices = array();
    while ($row_children = mysqli_fetch_assoc($res_children)) {
        $childDevices[] = $row_children['device_id'];
    }
    $exclude = implode(',', $childDevices);

    foreach ($devices as $id => $category) {

        if (!(in_array($id, $childDevices))) {
            echo '<row id="' . $id . '">';
            foreach ($category as $val => $columns) {
                $resultR = mysqli_query($conn,
                        "SELECT
                                    COUNT(device_id) devices
                            FROM
                                    ntk_template_fields
                            JOIN ntk_field_values ON ntk_template_fields.id = ntk_field_values.field_id
                            WHERE
                                    ntk_template_fields.`index_field` = '1'
                            AND ntk_field_values.field_value = '{$id}'
                            AND device_id NOT IN(" . $exclude . ")");

                $rowR = mysqli_fetch_assoc($resultR);
                $children = $rowR['devices'];

                if ($children > 0) {
                    echo "<cell image=\"folder.gif\"><![CDATA[" . $columns['Description'] . "]]></cell>";
                } else {
                    echo "<cell><![CDATA[" . $columns['Description'] . "]]></cell>";
                }
                echo '<cell>' . $id . '</cell>';
                echo "<cell><![CDATA[" . $val . "]]></cell>";
                echo '<cell>' . $columns['Date In'] . '</cell>';
                echo '<cell>' . $columns['Status'] . '</cell>';
                getChildObjects($id, $parent);
            }
            echo '</row>';
        }
    }
}

function generateCounter($x, $l) {
    $a = substr($x, $l);
    if (substr($a, 0, 1) == 0) {
        return generateCounter($a, $l + 1);
    } else {
        return $a;
    }
}

function templateFieldsGridXML($id) {

    global $conn;

    $query = "SELECT
                        *
                FROM
                        ntk_template_fields
                WHERE
                        templ_id = " . $id . "
                ORDER BY
                        parent_id DESC,
                        sort_id ASC";
    $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
    $objects = array();
    $roots = array();
    while ($row = mysqli_fetch_assoc($result)) {
        if (!isset($objects[$row['id']])) {
            $objects[$row['id']] = new stdClass;
            $objects[$row['id']]->children = array();
        }

        $obj = $objects[$row['id']];
        $obj->id = $row['id'];
        $obj->sort_id = $row['sort_id'];
        $obj->name = $row['name'];
        $obj->gridname = $row['gridname'];
        $obj->type = $row['type'];
        $obj->field_unique = $row['field_unique'];
        $obj->visible = $row['visible'];
        $obj->visible_in_form = $row['visible_in_form'];
        $obj->description = $row['description'];
        $obj->index_field = $row['index_field'];
        $obj->index_id = $row['index_id'];
        $obj->common = $row['common'];
        $obj->viewer = $row['viewer'];
        $obj->show_field = $row['show_field'];
        $obj->readonly = $row['readonly'];
        $obj->copy = $row['copy'];
        $obj->default_txt = $row['default_txt'];
        $obj->value = $row['value'];
        $obj->width = $row['width'];
        $obj->visible_in_unreal_popup = $row['visible_in_unreal_popup'];
        $obj->visible_in_unreal = $row['visible_in_unreal'];
        $obj->show_on_label = $row['show_on_label'];
        $obj->dependencies = $row['dependencies'];
        $obj->show_extra = $row['show_extra'];

        if ($row['parent_id'] == 0) {
            $roots[] = $obj;
        } else {
            if (!isset($objects[$row['parent_id']])) {
                $objects[$row['parent_id']] = new stdClass;
                $objects[$row['parent_id']]->children = array();
            }

            $objects[$row['parent_id']]->children[$row['id']] = $obj;
        }
    }
    foreach ($roots as $obj) {
        printTemplateFieldsGridXML($obj, true);
    }
}

function printTemplateFieldsGridXML(stdClass $obj, $isRoot = false) {

    echo '<row id="' . $obj->id . '">';
    echo '<cell></cell>';
    echo "<cell>" . $obj->sort_id . "</cell>";
    echo "<cell>" . $obj->id . "</cell>";
    if (count($obj->children) == 0) {
        echo "<cell image=\"blank.gif\"><![CDATA[" . $obj->name . "]]></cell>";
    } else {
        echo "<cell image=\"folder.gif\"><![CDATA[" . $obj->name . "]]></cell>";
    }
    echo "<cell><![CDATA[" . $obj->gridname . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->type . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->width . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->value . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->visible . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->visible_in_form . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->show_on_label . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->description . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->index_field . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->index_id . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->visible_in_unreal . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->viewer . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->show_field . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->readonly . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->copy . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->visible_in_unreal_popup . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->dependencies . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->show_extra . "]]></cell>";
    echo "<cell><![CDATA[" . $obj->default_txt . "]]></cell>";

    foreach ($obj->children as $child) {
        printTemplateFieldsGridXML($child);
    }
    echo '</row>';
}

function templateFieldsFormXML($id, $record_id) {

    global $conn;

    $query = "
        SELECT
            ntk_template_fields.*" . ($record_id ? ", ntk_field_values.field_value" : "") . "
        FROM
            ntk_template_fields
        JOIN ntk_templates ON ntk_templates.id = ntk_template_fields.templ_id
        " . ($record_id ? "LEFT JOIN ntk_field_values ON ntk_field_values.field_id = ntk_template_fields.id AND ntk_field_values.`device_id` = " . $record_id : "") . "
        WHERE
            ntk_templates.device_id = " . $id . "
        AND ntk_template_fields.visible_in_form = 1
        ORDER BY
            ntk_template_fields.parent_id = 0 DESC,
            ntk_template_fields.sort_id ASC";

    $result = mysqli_query($conn, $query) or die(mysqli_error($conn));
    $objects = array();
    $subfields = array();
    $roots = array();
    while ($row = mysqli_fetch_assoc($result)) {
        if (!isset($objects[$row['id']])) {
            $objects[$row['id']] = new stdClass;
            $objects[$row['id']]->children = array();
        }

        $obj = $objects[$row['id']];
        $obj->id = $row['id'];
        $obj->sort_id = $row['sort_id'];
        $obj->templ_id = $row['templ_id'];
        $obj->name = $row['name'];
        $obj->type = $row['type'];
        $obj->width = $row['width'];
        $obj->value = $row['value'];
        $obj->visible = $row['visible'];
        $obj->visible_in_form = $row['visible_in_form'];
        $obj->description = $row['description'];
        $obj->index_field = $row['index_field'];
        $obj->index_id = $row['index_id'];
        $obj->common = $row['common'];
        $obj->viewer = $row['viewer'];
        $obj->show_field = $row['show_field'];
        $obj->copy = $row['copy'];
        $obj->readonly = $row['readonly'];
        $obj->note = $row['default_txt'];
        $obj->field_value = $record_id ? $row['field_value'] : '';

        if ($row['parent_id'] == 0) {
            $roots[] = $obj;
        } else {

            $subfields[] = $row['id'];

            if (!isset($objects[$row['parent_id']])) {
                $objects[$row['parent_id']] = new stdClass;
                $objects[$row['parent_id']]->children = array();
            }

            $objects[$row['parent_id']]->children[$row['id']] = $obj;
        }
    }

    echo '<item type="settings" position="label-left"  labelWidth="170" inputWidth="230" offsetTop="5" offsetLeft="10"/>';

    if (count($subfields) > 0) {
        foreach ($roots as $obj) {
            printTemplateFieldsFormXML($obj, true);
        }
    } else {
        $cntr = 1;
        $numberOfFields = count($objects);
        if ($numberOfFields > 0) {

            foreach ($objects as $obj) {

                printTemplateFieldsFormXML($obj);

                if ($numberOfFields > 10 && (round($numberOfFields / 2) == $cntr)) {
                    if ($rowQry["id"] !== '1008') {
                        echo ("<item type='newcolumn'  offset='20'/>");
                    }
                }
                ++$cntr;
            }
        }
    }
}

function printTemplateFieldsFormXML(stdClass $obj, $isRoot = false) {

    global $conn, $options, $deviceCategory, $deviceSubCategory, $status_options, $branch_options, $project_options;
    $rows = '';
    $style = '';
    $className = 'formbox';
    $combotype = '';

    if ($isRoot && count($obj->children) > 0) {
        $type = $obj->type;
        if ($type == 'newcolumn') {
            echo ("<item type='newcolumn'  offset='20'/>");
        } else {

            echo '<item type="' . $obj->type . '" label="' . $obj->name . '">';

            foreach ($obj->children as $child) {
                printTemplateFieldsFormXML($child);
            }
            echo '</item>';
        }
    } else {
        $type = $obj->type;
        $info = false;
        $readonly = false;
        $dateFormat = '';
        $isTesting = false;

        if ($type == 'testing') {
            $type = 'combo';
            $isTesting = true;
        }

        if ($obj->name === 'Room') {
            $obj->field_value = (int) $obj->field_value;
        }

        if ($type == 'document' && $obj->field_value > 0) {

            $resultR = mysqli_query($conn, "SELECT Report_Subject FROM nts_site.tradestar_reports WHERE Report_ID = " . $obj->field_value);

            $rowR = mysqli_fetch_assoc($resultR);
            $doc_subject = $rowR['Report_Subject'];

            $obj->field_value .= ' | ' . $doc_subject;
        }

        if (!$type || $type == 'password' || $type == 'crm' || $type == 'document') {
            $type = 'input';
        }
        if ($type == 'multiline') {
            $type = 'input';
            if ($obj->value <= 10) {
                $rows = 'rows="' . $obj->value . '"';
            } else {
                $rows = 'rows="10"';
            }
        }
        if ($obj->name === 'Date In' || $obj->name === 'Date Out') {
            $type = 'calendar';
        }

        if ($obj->index_id > 0) {

            if ($obj->index_field > 0) {
                $readonly = true;
                $style = 'background-color:#e6e6e6;';
            }

            $info = true;
        }

        if (isset($options[$obj->id]) && (count($options[$obj->id]) > 0) && $indexField === 0) {
            $type = 'combo';
        }

        if ($obj->readonly > 0 || $obj->name === 'Description') {
            $readonly = true;
            $style = 'background-color:#e6e6e6;';
        }


        if ($obj->type == 'combo_multi') {
            $fieldname = 'combo_' . $obj->id;
        } else {
            $fieldname = 'form_' . $obj->id;
        }


        if ($obj->type === 'combo_multi') {
            $type = 'combo';
            $combotype = "comboType='checkbox'";
            echo ("<item type='hidden'  inputWidth='" . $obj->width . "'  name='form_" . $obj->id . "' label='" . $obj->name . "' readonly ='" . $readonly . "' className='" . $className . "'  style='" . $style . "' />" . ($obj->note ? '<note>' . $obj->note . '</note>' : ''));
        }

        if ($type === 'menu_multi' || $type === 'menu') {

            $info = true;
            $type = 'input';
            $fieldname = 'menu_' . $obj->id;
            echo ("<item type='" . $type . "' inputWidth='" . $obj->width . "'  $rows name='$fieldname' label='" . $obj->name . "' info='" . $info . "' readonly ='" . $readonly . "' className='" . $className . "'  style='" . $style . "' />" . ($obj->note ? '<note>' . $obj->note . '</note>' : ''));
        } elseif ($type === 'newcolumn') {

            echo ("<item type='newcolumn'  offset='20'/>");
        } else {

            if ($type === 'calendar') {
//                $dateFormat = 'dateFormat="%d-%m-%Y" serverDateFormat="%d-%m-%Y"';
            }

            if ($type === 'project_id') {
                $type = 'combo';
            }

            echo '<item type="' . $type . '" ' . $combotype . ' inputWidth="' . $obj->width . '" name="' . $fieldname . '" label="' . $obj->name . '" info="' . $info . '" ' . $rows . ' readonly ="' . $readonly . '" className="formbox"  style="' . $style . '" ' . $dateFormat . ' >' . ($obj->note ? '<note>' . $obj->note . '</note>' : '');

            if ($obj->name === 'Status' && $obj->common === '1') {
                echo("<option text='' value=''/>");
                foreach ($status_options as $opt_id => $opt_name) {
                    echo("<option text='" . $opt_name . "' value='" . $opt_name . "'  " . ($opt_name === $obj->field_value ? "selected='true'" : "") . "/>");
                }
            } elseif ($obj->name === 'Branch' && $obj->common === '1') {

                echo("<option text='' value=''/>");
                foreach ($branch_options as $branch_id => $branch_name) {
                    echo("<option text='" . $branch_name . "' value='" . $branch_id . "' " . ($branch_id === (int) $obj->field_value ? "selected='true'" : "") . "/>");
                }
            } elseif ($obj->templ_id === '362') {

                if ($obj->name === 'Main category') {

                    echo("<option text='' value='0'/>");
                    foreach ($deviceCategory as $cat) {
                        echo("<option text='" . $cat->name . "' value='" . $cat->id . "' " . ($cat->id === (int) $obj->field_value ? "selected='true'" : "") . "/>");
                    }
                }

                if ($obj->name === 'Sub category') {

                    echo("<option text='' value='0'/>");
                    foreach ($deviceSubCategory as $sub) {
                        echo("<option text='" . $sub->name . "' value='" . $sub->id . "' " . ($sub->id === (int) $obj->field_value ? "selected='true'" : "") . "/>");
                    }
                }
            } elseif ($obj->type === 'project_id') {

                echo("<option text='' value=''/>");
                foreach ($project_options as $project_id => $project_name) {
                    echo("<option text='" . $project_name . "' value='" . $project_id . "' " . ($project_id === (int) $obj->field_value ? "selected='true'" : "") . "/>");
                }
            } elseif ($isTesting) {

                echo("<option text='Undefined' value=''/>");
                echo("<option text='Passed' value='V'/>");
                echo("<option text='Failed' value='X'/>");
                echo("<option text='Not Available' value='Not Available'/>");
                echo("<option text='Not Tested' value='Not Tested'/>");
            } else {

                if ($type === 'combo') {
                    echo("<option text='' value=''/>");
                }
                foreach ($options[$obj->id] as $opt_id => $opt_name) {
                    echo("<option text='" . $opt_name . "' value='" . $opt_name . "' " . ($opt_name === $obj->field_value ? "selected='true'" : "") . "/>");
                }
            }

            echo '</item>';
        }
    }
}

function treeDirSystemEntry() {

    global $conn;

    $result = mysqli_query($conn, "
        SELECT
            ntk_devices.id,
            ntk_devices.name,
            ntk_devices.sort_id,
            ntk_devices.parent_id,
            ntk_templates.id template_id
        FROM
            ntk_devices
        JOIN ntk_templates ON ntk_templates.device_id = ntk_devices.id        
        ORDER BY
            parent_id = 0 DESC, ntk_devices.id 
                ");

    $objects = array();
    $roots = array();
    while ($row = mysqli_fetch_assoc($result)) {
        if (!isset($objects[$row['id']])) {
            $objects[$row['id']] = new stdClass;
            $objects[$row['id']]->children = array();
        }

        $obj = $objects[$row['id']];
        $obj->id = $row['id'];
        $obj->name = $row['name'];
        $obj->sort_id = $row['sort_id'];
        $obj->template_id = $row['template_id'];

        if ($row['id'] == 538) {
            $roots[] = $obj;
        } else {
            if (!isset($object[$row['parent_id']])) {
                $object[$row['parent_id']] = new stdClass;
                $object[$row['parent_id']]->children = array();
            }

            $objects[$row['parent_id']]->children[$row['id']] = $obj;
        }
    }

    foreach ($roots as $obj) {
        printXMLSystemEntry($obj, true);
    }
}

function printXMLSystemEntry(stdClass $obj, $isRoot = false) {
    echo '<row id="' . $obj->id . '">';
    if (count($obj->children) == 0) {
        echo '<cell>' . $obj->name . '</cell>';
    } else {
        echo '<cell image="folder.gif">' . $obj->name . '</cell>';
    }
    echo '<cell>' . $obj->template_id . '</cell>';
    echo '<cell>' . $obj->sort_id . '</cell>';

    foreach ($obj->children as $child) {
        printXMLSystemEntry($child);
    }

    echo '</row>';
}

function devicesOnlyInUseQuery() {

    global $conn;

    $query = "
            SELECT 
              ntk_template_fields.`name`,
              ntk_device_records.id,
              ntk_template_fields.id field_id,
              ntk_template_fields.common,
              ntk_template_fields.index_field,
              ntk_template_fields.visible,
              ntk_template_fields.description,
              (
                CASE
                  WHEN ntk_template_fields.`name` = 'Description' 
                  AND ntk_template_fields.`common` = '1' 
                  THEN '' 
                  WHEN ntk_template_fields.`name` = 'Branch' 
                  AND ntk_template_fields.`common` = '1' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    Branch_Name 
                  FROM
                    nts_site.branch 
                  WHERE visible = 1 
                    AND Branch_ID = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`name` = 'Room' 
                  AND ntk_template_fields.`common` = '1' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    `name` 
                  FROM
                    `ntk_rooms` 
                  WHERE `id` = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`name` = 'Main category' 
                  AND ntk_template_fields.`common` = '0' 
                  AND ntk_template_fields.`templ_id` = '362' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    `name` 
                  FROM
                    `ntk_devices` 
                  WHERE `id` = (ntk_field_values.field_value)) 
                  WHEN ntk_template_fields.`name` = 'Sub category' 
                  AND ntk_template_fields.`common` = '0' 
                  AND ntk_template_fields.`templ_id` = '362' 
                  AND ntk_field_values.field_value > 0 
                  THEN 
                  (SELECT 
                    `name` 
                  FROM
                    `ntk_devices` 
                  WHERE `id` = (ntk_field_values.field_value)) 
                  ELSE ntk_field_values.field_value 
                END
              ) AS field_value 
            FROM
              ntk_device_records 
              JOIN ntk_templates 
                ON ntk_templates.device_id = ntk_device_records.device_id 
              JOIN ntk_field_values 
                ON ntk_device_records.id = ntk_field_values.device_id 
              JOIN ntk_template_fields 
                ON ntk_field_values.field_id = ntk_template_fields.id 
                AND ntk_template_fields.templ_id = ntk_templates.id 
              JOIN 
                (SELECT 
                  ntk_field_values.device_id 
                FROM
                  ntk_field_values 
                  JOIN ntk_template_fields 
                    ON ntk_template_fields.id = ntk_field_values.field_id 
                    AND ntk_template_fields.templ_id = 
                    (SELECT 
                      id 
                    FROM
                      ntk_templates 
                    WHERE device_id = " . $deviceId . " ) 
                    AND ntk_template_fields.`name` = 'status' 
                WHERE REPLACE(
                    ntk_field_values.field_value,
                    ' ',
                    ''
                  ) = 'inuse') activeDevices 
                ON ntk_device_records.id = activeDevices.device_id   
            WHERE ntk_templates.device_id = " . $deviceId . " 
              AND ntk_template_fields.type <> 'password' 
            GROUP BY ntk_device_records.id,
              ntk_template_fields.id 
            ORDER BY ntk_device_records.id,
              ntk_template_fields.sort_id ";
}

function copyFieldOptions($srcId, $destId) {

    global $conn;

    $query = "SELECT * FROM ntk_fields_options WHERE field_id =" . $srcId . " ORDER BY sort_id";
    $result = mysqli_query($conn, $query) or die(mysqli_error($conn));

    while ($row = mysqli_fetch_array($result)) {
        $sql_sort_max = "SELECT max(sort_id) as mx FROM ntk_fields_options WHERE field_id = " . $destId;
        $res_mx = mysqli_query($conn, $sql_sort_max) or die(mysqli_error($conn));
        $row_mx = mysqli_fetch_assoc($res_mx);
        $sort = $row_mx['mx'];
        $sort++;

        $QRY_INSERT_TEMPLATE_FIELDS = "INSERT INTO ntk_fields_options(`name`,`sort_id`,`field_id`) VALUES ('" . $row['name'] . "','{$sort}','" . $destId . "')";
        mysqli_query($conn, $QRY_INSERT_TEMPLATE_FIELDS);
    }
}
