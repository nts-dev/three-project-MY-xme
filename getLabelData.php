<?php
ini_set('display_errors', '0');
header("Access-Control-Allow-Origin: *");

$dbc = mysqli_connect('83.98.243.189', 'root', 'kenya1234', 'nts_network');
if (!$dbc) {
    trigger_error('Could not connect to MySQL: ' . mysqli_connect_error());
}
$dbc2 = mysqli_connect('83.98.243.185', 'root', 'wgnd8b', 'nts_site');
if (!$dbc2) {
    trigger_error('Could not connect to MySQL: ' . mysqli_connect_error());
}

$action = filter_input(INPUT_GET, 'action', FILTER_SANITIZE_NUMBER_INT);

switch ($action) {

    default :
        break;

    case 1:
        $branchID = filter_input(INPUT_GET, 'branch_id');
//        $recordList = getRecords($branchID);
        $list = getConvertedLabelData($branchID);

//        echo '<pre>';
//        print_r($list);
      echo json_encode($list);
        //echo json_encode([]);
        break;
    case 2:
        $parno = filter_input(INPUT_GET, 'partno');
        $model = filter_input(INPUT_GET, 'model');
        $list = getLocationsFromPartNo($parno, $model);
//        echo  '<pre>';
//        print_r($list);
        echo json_encode($list);
        break;

    case 3:
        header("Content-type:text/xml");
        print("<?xml version = \"1.0\"?>");
        echo "<rows>";
        $locationId = filter_input(INPUT_GET, "location", FILTER_SANITIZE_STRING);
        $branchId = filter_input(INPUT_GET, "branch", FILTER_SANITIZE_NUMBER_INT);
        $query = "SELECT
                     serialno.Location_ID,serialno.NTS_Partno,
                     l2.Item_name AS State_cond,
                     SUM(Quantity_Int) AS Quantity_Int

                    FROM
                     serialno
                    LEFT JOIN
                     nts_site.process ON Process_ID = product_status_id
                    LEFT JOIN
                     lookuptable l2 ON l2.Item_Value = serialno.Status_ID AND l2.Sort_Id = '38' WHERE Location_ID = '".$locationId."' and Product_Status_ID=4
                     GROUP BY Location_ID,NTS_Partno    ";


        $result = mysqli_query($dbc2, $query);
        while ($row = mysqli_fetch_assoc($result)) {
            $id = $row["NTS_Partno"].'-'.$row["Location_ID"];
            echo "<row id = '{$id}'>";
            echo "<cell><![CDATA[" . $row["Location_ID"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["NTS_Partno"] . "]]></cell>";
            $conditions = array("Pulles", "Undefined");
            $condit = ($row["Condit"]) ? $row["Condit"] : (empty($row['State_cond']) || in_array($row['State_cond'], $conditions) ? "Used Grade A" : $row['State_cond']);
            echo "<cell><![CDATA[" . $condit . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Quantity_Int"] . "]]></cell>";
            echo "</row>";
        }
        echo "</rows>";

 break;
    case 4:
        header("Content-type:text/xml");
        print("<?xml version = \"1.0\"?>");
        echo "<rows>";
        $locationId = filter_input(INPUT_GET, "location", FILTER_SANITIZE_STRING);
        $partNo = filter_input(INPUT_GET, "PartNo", FILTER_SANITIZE_NUMBER_INT);
        $query = "SELECT serialno.NTS_Serialno,serialno.Model,serialno.NTS_Partno,serialno.Description,serialno.Location_ID,
                    serialno.Man_Serialno,serialno.Quantity_Int,process.Process_Name,l2.Item_name AS State_cond, l2.Item_name AS State_cond
                    FROM serialno
                    LEFT JOIN nts_site.process ON Process_ID = product_status_id
                    LEFT JOIN lookuptable l2 ON l2.Item_Value = serialno.Status_ID AND l2.Sort_Id = '38'
                    WHERE Location_ID = '".$locationId."' AND Product_Status_ID=4 AND NTS_Partno =".$partNo;

        $result = mysqli_query($dbc2, $query);
        while ($row = mysqli_fetch_assoc($result)) {
            echo "<row id = '{$row["NTS_Serialno"]}'>";
            echo "<cell><![CDATA[" . $row["NTS_Serialno"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Model"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["NTS_Partno"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Description"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Location_ID"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Man_Serialno"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Quantity_Int"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Process_Name"] . "]]></cell>";
            $conditions = array("Pulles", "Undefined");
            $condit = ($row["Condit"]) ? $row["Condit"] : (empty($row['State_cond']) || in_array($row['State_cond'], $conditions) ? "Used Grade A" : $row['State_cond']);
            echo "<cell><![CDATA[" . $condit . "]]></cell>";

            echo "</row>";
        }
        echo "</rows>";

        break;

    case  5:
        header("Content-type:text/xml");
        print("<?xml version = \"1.0\"?>");
        echo "<rows>";
        $locationId = filter_input(INPUT_GET, "location", FILTER_SANITIZE_STRING);
        $query = "SELECT
                serialno.*,
                process.Process_Name,
                l2.Item_name AS State_cond,
                Quantity_Int,
                model
            FROM
                serialno
                    LEFT JOIN
                nts_site.process ON Process_ID = product_status_id
                    LEFT JOIN
                lookuptable l2 ON l2.Item_Value = serialno.Status_ID
                    AND l2.Sort_Id = '38' where Location_ID = '".$locationId."' and Product_Status_ID=4 ";

        $result = mysqli_query($dbc2, $query);
        while ($row = mysqli_fetch_assoc($result)) {
            echo "<row id = '{$row["NTS_Serialno"]}'>";
            echo "<cell><![CDATA[" . $row["NTS_Serialno"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Model"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["NTS_Partno"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Description"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Location_ID"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Man_Serialno"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Quantity_Int"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Process_Name"] . "]]></cell>";
            $conditions = array("Pulles", "Undefined");
            $condit = ($row["Condit"]) ? $row["Condit"] : (empty($row['State_cond']) || in_array($row['State_cond'], $conditions) ? "Used Grade A" : $row['State_cond']);
            echo "<cell><![CDATA[" . $condit . "]]></cell>";

            echo "</row>";
        }
        echo "</rows>";
    break;

    case 6:
        header("Content-type:text/xml");
        print("<?xml version = \"1.0\"?>");
        echo "<rows>";
        $partNo = filter_input(INPUT_GET, "partNo");
        $model = filter_input(INPUT_GET, "model");
      $value = 'NTS_Partno';
      if($model){
          $value = 'Model';
          $partNo = $model;
      }


        $query = "SELECT
                     serialno.Location_ID,serialno.NTS_Partno,
                     l2.Item_name AS State_cond,
                     SUM(Quantity_Int) AS Quantity_Int

                    FROM
                     serialno
                    LEFT JOIN
                     nts_site.process ON Process_ID = product_status_id
                    LEFT JOIN
                     lookuptable l2 ON l2.Item_Value = serialno.Status_ID AND l2.Sort_Id = '38' WHERE ".$value." = '".$partNo."' and Product_Status_ID=4
                     GROUP BY Location_ID,NTS_Partno    ";


        $result = mysqli_query($dbc2, $query);
        while ($row = mysqli_fetch_assoc($result)) {
                $id = $row["NTS_Partno"].'-'.$row["Location_ID"];
            echo "<row id = '{$id}'>";
            echo "<cell><![CDATA[" . $row["Location_ID"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["NTS_Partno"] . "]]></cell>";
            $conditions = array("Pulles", "Undefined");
            $condit = ($row["Condit"]) ? $row["Condit"] : (empty($row['State_cond']) || in_array($row['State_cond'], $conditions) ? "Used Grade A" : $row['State_cond']);
            echo "<cell><![CDATA[" . $condit . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Quantity_Int"] . "]]></cell>";
            echo "</row>";
        }
        echo "</rows>";
        break;

    case  7:
        header("Content-type:text/xml");
        print("<?xml version = \"1.0\"?>");
        echo "<rows>";
        $partNo = filter_input(INPUT_GET, "partNo", FILTER_SANITIZE_STRING);
        $model = filter_input(INPUT_GET, "model", FILTER_SANITIZE_STRING);
        $value = 'NTS_Partno';
        if($model){
            $value = 'Model';
            $partNo = $model;
        }
        $query = "SELECT
                serialno.*,
                process.Process_Name,
                l2.Item_name AS State_cond,
                Quantity_Int,
                model
            FROM
                serialno
                    LEFT JOIN
                nts_site.process ON Process_ID = product_status_id
                    LEFT JOIN
                lookuptable l2 ON l2.Item_Value = serialno.Status_ID
                    AND l2.Sort_Id = '38' where ".$value." = '".$partNo."' and Product_Status_ID=4 ";

        $result = mysqli_query($dbc2, $query);
        while ($row = mysqli_fetch_assoc($result)) {
            echo "<row id = '{$row["NTS_Serialno"]}'>";
            echo "<cell><![CDATA[" . $row["NTS_Serialno"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Model"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["NTS_Partno"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Description"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Location_ID"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Man_Serialno"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Quantity_Int"] . "]]></cell>";
            echo "<cell><![CDATA[" . $row["Process_Name"] . "]]></cell>";
            $conditions = array("Pulles", "Undefined");
            $condit = ($row["Condit"]) ? $row["Condit"] : (empty($row['State_cond']) || in_array($row['State_cond'], $conditions) ? "Used Grade A" : $row['State_cond']);
            echo "<cell><![CDATA[" . $condit . "]]></cell>";

            echo "</row>";
        }
        echo "</rows>";
        break;
}

function getLocationsFromPartNo($parno, $model){
    global $dbc2;
    $value = 'NTS_Partno';
    if($model){
        $value = 'model';
        $parno = $model;
    }
    $statement = "SELECT DISTINCT serialno.Location_ID FROM nts_site.serialno where ".$value." ='".$parno."'";
    $recordList=[];

    $result = mysqli_query($dbc2, $statement);
    while ($row = mysqli_fetch_assoc($result)) {
        $locationID = $row['Location_ID'];
        $label = new stdClass();
        $label->id = $locationID;
        $recordList[]= $label;
    }


    return $recordList;

}
function findLabel($recordList,$list){
  $labels = [];

    foreach ($recordList as $label){
       $id = $label['Location'].$label['RackID'];
       $foundLabel =  $list[$id];
       if($foundLabel){

           if (strpos($foundLabel->Location, 'front') !== false) {
               $label['Xpos']=($foundLabel->Xpos+(-3));
           }
           else if (strpos($foundLabel->Location, 'back') !== false) {
               $label['Xpos']=($foundLabel->Xpos+(4));
           }

           $label['Ypos']=$foundLabel->Ypos;
           $label['Zpos']=$foundLabel->Zpos;

           //$label['Location']='';
       }


        $labels[] = $label;

    }
    return $labels;
}
function getConvertedLabelData($branchID){
    global $dbc;
    $query = 'SELECT * from conversion_table where Branch = '.$branchID.' ORDER BY  RackID, shelfId, position ';
    $result = mysqli_query($dbc, $query);
    $list = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $label = new stdClass();
        $label->Xpos = $row['X_pos'];
        $label->Ypos = $row['Y_pos'];
        $label->Zpos = $row['Z_pos'];
        $label->Location = $row['Location'];
        $label->RackID = $row['RackID'];
        $label->pos = $row['Position'];
        $label->branch = $row['Branch'];
        $label->angle = $row['angle'];
        $label->shelf = $row['ShelfID'];
        $label->LocationID = $row['Branch']. $row['RackID'].'/'.$row['ShelfID'].'/'.$row['Position'];
        $id = $row['Location'].$row['RackID'];
        $list[$id] = $label;

    }
    return $list;
}



function getRecords($branchID)
{
    global $dbc;
    $recordList = [];
    $statement = "SELECT ntk_field_values.*,ntk_template_fields.name
                    FROM ntk_device_records
                    JOIN ntk_field_values ON ntk_field_values.device_id = ntk_device_records.id
                    JOIN ntk_template_fields ON ntk_template_fields.id = ntk_field_values.field_id
                    WHERE ntk_device_records.device_id = 1296 AND ntk_device_records.branch_id =" . $branchID;
    $result = mysqli_query($dbc, $statement);
    $ids = [];
    $locations = [];
    $productList =[];
    while ($row = mysqli_fetch_assoc($result)) {

        $name = str_replace('-', '', $row['name']);
        $parentDeviceId = $row['device_id'];
        $recordList[$parentDeviceId][$name] = $row['field_value'];


        if ($name == 'AssetID' || $name == 'AssetID2') {
            if (!empty($row['field_value']) && is_numeric($row['field_value'])) {
                $ids[$parentDeviceId][] = $row['field_value'];
            }
        }
        if ($name == 'Location') {
//            echo $row['field_value'].'<br>';
            if (!empty($row['field_value']) ) {
                $id = $row['field_value'];
                $id = explode('/',$id);
                $id = end($id);
                if(preg_match("/[a-z]/i", $id)){
                   continue;
                }
                $locations[$parentDeviceId] = $id ;

            }
        }
    }

    foreach ($ids as $parentId => $values){
        if (count($values) > 0) {
            $statement = "SELECT ntk_field_values.*,ntk_template_fields.name
                    FROM ntk_device_records
                    JOIN ntk_field_values ON ntk_field_values.device_id = ntk_device_records.id
                    JOIN ntk_template_fields ON ntk_template_fields.id = ntk_field_values.field_id
                    WHERE ntk_device_records.device_id = 989 AND ntk_device_records.id IN(" . implode(",", $values) . ")";
            $result = mysqli_query($dbc, $statement);

            while ($row = mysqli_fetch_assoc($result)) {
                $name = str_replace('-', '', $row['name']);
                $name = str_replace(' ', '', $name);

                if(!empty($row['field_value']))
                $recordList[$parentId]['labelProperties'][$row['device_id']][$name] = $row['field_value'];
            }

        }
    }
//    getProductsFromLocationId($locations,$recordList);
//return $recordList;

    return getProductsFromLocationId($locations,$recordList);

}

function getProductsFromLocationId($LocationList,$recordList){
    global $dbc;
    foreach ($LocationList as $parentId => $values){

            $statement = "SELECT serialno.Serialno,serialno.NTS_Partno FROM nts_site.serialno where Location_ID =".$values;

            $result = mysqli_query($dbc, $statement);
            while ($row = mysqli_fetch_assoc($result)) {
                $partno = $row['NTS_Partno'];
                 //$recordList[$parentId]['partNumbers'][$partno]= $partno;

                $recordList =  getLocationsFromProducts($recordList,$parentId,$partno);
            }
    }

 return $recordList;

}
function getLocationsFromProducts($recordList,$parentId,$partno){
    global $dbc;
    $statement = "SELECT DISTINCT serialno.Location_ID FROM nts_site.serialno where NTS_Partno =".$partno;

    $result = mysqli_query($dbc, $statement);
    while ($row = mysqli_fetch_assoc($result)) {
        $locationID = $row['Location_ID'];

        $recordList[$parentId]['partNumbers'][$partno][$locationID]= $locationID;
    }


   return $recordList;

}
