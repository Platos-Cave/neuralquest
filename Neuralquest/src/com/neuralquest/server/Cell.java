package com.neuralquest.server;

import java.awt.Dimension;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.Map;
import java.util.Set;

import javax.vecmath.Vector3d;

import org.dom4j.Element;
import org.json.JSONObject;

import com.neuralquest.server.base.BaseCell;



/**
 * @copyright Chris de Jong 2005
 * @name Cell.java
 *
 */
public class Cell extends BaseCell implements Constants {
	private static final long serialVersionUID = 1L;
	
	/*[CONSTRUCTOR MARKER BEGIN]*/
	public Cell () {
		super();
	}

	/**
	 * Constructor for primary key
	 */
	public Cell (long id) {
		super(id);
	}

	/**
	 * Constructor for required fields
	 */
	public Cell (
		long id,
		byte type) {

		super (
			id,
			type);
	}

	/*[CONSTRUCTOR MARKER END]*/
	/**
	 * getName
	 * @param maxLength 
	 */
	public String getName(int maxLength) {
		String cellName = "[null]";
		if(getType()==CLASS || isA(ATTRIBUTES_ID)) cellName = getName(); 
		else {
			Cell primaryNameCell = getAttributeObjByDestClass(PRIMARY_NAME_ID); // primary name
			cellName = primaryNameCell==null?"[no primary name]":primaryNameCell.getName();
		}
		if(maxLength>0 && cellName.length() > 0 && cellName.length() > maxLength) {
			if(cellName.lastIndexOf(' ', maxLength) > 0) cellName = cellName.substring(0,cellName.lastIndexOf(' ', maxLength)) + "...";
			else cellName = cellName.substring(0, maxLength) + "...";
		}
		return cellName;
	}
	public String getIdName(int maxLength) {
		return getId()+" - "+getName(maxLength);
	}
	public boolean isA(long id) {
		LinkedList<Cell> loopProtection = new LinkedList<Cell>();
		return isA(id, loopProtection);
	}
	private boolean isA(long id, LinkedList<Cell> loopProtection) {
		if(loopProtection.contains(this)) {
			System.out.println("ERROR:\tCircular reference in parent list");
			System.out.println("source:\t"+this.getIdName(50));
			System.out.println("list:\t"+listToString(loopProtection));
			throw new RuntimeException("Circular reference in parent list");
		}
		loopProtection.add(this);
		if(this.getId() == id) return true;
		for(Iterator<Assoc> itr1=getSourceAssocs().iterator();itr1.hasNext();){
			Assoc a = ((Assoc)itr1.next());
			if(a.getType() == PARENT_ASSOC){
				return (a.getDestFk().isA(id, loopProtection));
			}
		}
		return false;		
	}
	public boolean isA(Cell id) {
		LinkedList<Cell> loopProtection = new LinkedList<Cell>();
		return isA(id, loopProtection);
	}
	private boolean isA(Cell type, LinkedList<Cell> loopProtection) {
		if(loopProtection.contains(this)) {
			System.out.println("ERROR:\tCircular reference in parent list");
			System.out.println("source:\t"+this.getIdName(50));
			System.out.println("list:\t"+listToString(loopProtection));
			throw new RuntimeException("Circular reference in parent list");
		}
		loopProtection.add(this);
		if(this.equals(type)) return true;
		for(Iterator<Assoc> itr1=getSourceAssocs().iterator();itr1.hasNext();){
			Assoc a = ((Assoc)itr1.next());
			if(a.getType() == PARENT_ASSOC){
				return (a.getDestFk().isA(type, loopProtection));
			}
		}
		return false;		
	}
	public LinkedList<Cell> getListOfSuperClasses() {
		LinkedList<Cell> pList = new LinkedList<Cell>();
		getListOfSupperClasses(pList);
		return pList;
	}
	private void getListOfSupperClasses(LinkedList<Cell> pList) {
		//will also include the first one if it is a class
		//System.out.println(getIdName(0));
		if(pList.contains(this)) {
			System.out.println("ERROR:\tCircular reference in parent list");
			System.out.println("source:\t"+this.getIdName(50));
			System.out.println("list:\t"+listToString(pList));
			throw new RuntimeException("Circular reference in parent list");
		}
		if(getType()==CLASS) pList.add(this);//Do not add if this is a Object
		for(Iterator<Assoc> itr1=getSourceAssocs().iterator();itr1.hasNext();){
			Assoc assoc = itr1.next();
			if(assoc.getType() != PARENT_ASSOC) continue;// if not, go to the next
			Cell pCell = assoc.getDestFk();
			pCell.getListOfSupperClasses(pList);
		}
	}

	public LinkedList<Cell> getListOfInstances(){
		LinkedList<Cell> list = new LinkedList<Cell>();
		getListOfInstances(list);
		return list;
	}
	private void getListOfInstances(LinkedList<Cell> list){
		if(getType()==OBJECT) {
			if(list.contains(this)) {
				System.out.println("ERROR:\tMultiple reference in instance list");
				//System.out.println("source:\t"+this.getIdName(50));
				System.out.println("source:\t"+this.getId()+" - "+this.getName());
				System.out.println("list:\t"+listToString(list));
				throw new RuntimeException("Multiple reference in instance list");
			}
			list.add(this);
			return; 
		}
		for(Iterator<Assoc> itr1=getDestAssocs().iterator();itr1.hasNext();){
			Assoc assoc = itr1.next();
			if(assoc.getType() != PARENT_ASSOC) continue;// if not, go to the next
			Cell subclass = assoc.getSourceFk();
			subclass.getListOfInstances(list);
		}
	}
	public LinkedList<Cell> getLsitOfAllSubClasses(){
		LinkedList<Cell> list = new LinkedList<Cell>();
		getLsitOfAllSubClasses(list);
		return list;
	}
	private void getLsitOfAllSubClasses(LinkedList<Cell> list){
		if(getType()==OBJECT) return; 
		if(list.contains(this)) {
			System.out.println("ERROR:\tCircular reference in child list");
			System.out.println("source:\t"+this.getIdName(50));
			System.out.println("list:\t"+listToString(list));
			throw new RuntimeException("Circular reference in child list");
		}
		list.add(this);
		for(Iterator<Assoc> itr1=getDestAssocs().iterator();itr1.hasNext();){
			Assoc assoc = itr1.next();
			if(assoc.getType() != PARENT_ASSOC) continue;// if not, go to the next
			Cell subclass = assoc.getSourceFk();
			subclass.getLsitOfAllSubClasses(list);
		}
	}
	/**
	 * Returns a cell that has a particular rel type to this one
	 * Only one expected  
	 * @return Cell linked through relTypeId, or null
	 */
	//TODO we should try to get rid of this
	public Cell getCellByAssocType(long relTypeId){
		//System.out.println(getIdName(50));
		for(Iterator<Assoc> itr1=getSourceAssocs().iterator();itr1.hasNext();){
			Assoc a1 = (Assoc)itr1.next();
			//System.out.println("\t"+a1.getDestFk().getIdName(50));
			if(a1.getType() == relTypeId){
				return a1.getDestFk();
			}
		}
		return null;
	}
	public LinkedList<Cell> getListOfRelatedObjectsByView(Cell viewObj){
		Cell destClass = viewObj.getCellByAssocType(MAPSTO_ASSOC);;
		Cell prevRelType = viewObj.getAttributeObjByDestClass(ASSOCIATION_TYPES_ID);
		if(prevRelType==null) return new LinkedList<Cell>();		
		return getListOfRelatedObjectsByAssocTypeAndDestClassId(prevRelType.getId(), destClass==null?0:destClass.getId());
	}
	public LinkedList<Cell> getListOfRelatedObjectsByAssocTypeAndDestClassId(long assocType, long destClassId){
		// This the primary retieval algorithime. TODO All gets should gravitate towards this.
		if(assocType==ORDERED_ASSOC){
			LinkedList<Cell> list = new LinkedList<Cell>();
			LinkedList<Cell> orderedList = lookForward(assocType, destClassId);//should return only one
			if(getType()==OBJECT){
				for(Iterator<Cell> itr1=orderedList.iterator();itr1.hasNext();){
					Cell ordered = (itr1.next());
					list.add(ordered);
					ordered.addNextToListByDestClass(list, destClassId);
				}
			}
			return list;
		}
		else if(assocType>=PARENT_ASSOC && assocType<=OWNS_ASSOC){
			return lookForward(assocType, destClassId);
		}
		else if(assocType==ORDERED_PARENT_PASSOC){
			LinkedList<Cell> list = new LinkedList<Cell>();
			Cell orderedParent = findFirstReverse(destClassId); 
			if(orderedParent!=null) list.add(orderedParent);
			return list;
		}
		else if(assocType>=CHILDREN_PASSOC && assocType<=OWNED_BY_PASSOC){
			byte primitiveAssocType = (byte)(assocType - 12);// Big NoNo: here we do math with identifires
			return lookBackward(primitiveAssocType, destClassId);
		}
		/*else if(assocType==BY_ORG_UNIT_PASSOC){
			LinkedList<Cell> orgUnitList = getListOfRelatedObjectsByAssocTypeAndDestClassId(MANYTOMANY_ASSOC, ORG_UNIT_ID);
			for(Iterator<Cell> itr0=orgUnitList.iterator();itr0.hasNext();){
				Cell orgUnitObj = itr0.next();
				Cell orgStateObj = orgUnitObj.getCellByAssocType(MAPSTO_ASSOC);;
				if(orgStateObj==null) continue;
				Cell viewObj = orgUnitObj.getObjectByAssocTypeAndDestClass(MANYTOONE_PASSOC, VIEWS_ID);
				if(viewObj==null) continue;
				Cell destClass = viewObj.getCellByAssocType(MAPSTO_ASSOC);;
				if(destClass==null) continue;
				LinkedList<Cell> objList = destClass.getListOfInstances();
				for(Iterator<Cell> itr1=objList.iterator();itr1.hasNext();){
					Cell obj = itr1.next();
					Cell objStateObj = obj.getAttributeObjByDestClass(STATES_ID);
					if(objStateObj==null) continue;
					if(objStateObj.equals(orgStateObj)){
						JSONObject objObj = new JSONObject();
						objObj.put("$ref", viewObj.getId()+"/"+obj.getId());
						objObj.put("view name", "all view");
						assocArray.put(objObj);
					}
				}
			}
		}*/
		return new LinkedList<Cell>();
	}

	public LinkedList<Cell> getListOfRelatedObjectsByAssocTypeAndDestClass(long assocType, Cell destClass){
		return getListOfRelatedObjectsByAssocTypeAndDestClassId(assocType, destClass==null?0:destClass.getId());
	}
	private LinkedList<Cell> lookBackward(long assocType, long destClassId){
		LinkedList<Cell> list = new LinkedList<Cell>();
		for(Iterator<Assoc> itr=getDestAssocs().iterator();itr.hasNext();){
			Assoc assoc1 = (Assoc)itr.next();
			if(assoc1.getType()==assocType && (destClassId == 0 || assoc1.getSourceFk().isA(destClassId))) {
				list.add((Cell)assoc1.getSourceFk());
			}
		}
		return list;
	}
	private LinkedList<Cell> lookForward(long assocType, long destClassId){
		LinkedList<Cell> list = new LinkedList<Cell>();
		for(Iterator<Assoc> itr=getSourceAssocs().iterator();itr.hasNext();){
			Assoc assoc1 = (Assoc)itr.next();
			if(assoc1.getType()==assocType && (destClassId == 0 || assoc1.getDestFk().isA(destClassId))) {
				list.add((Cell)assoc1.getDestFk());
			}
		}
		return list;
	}
	public Cell getAttributeObjByDestClass(long destClassId){
		return getObjectByAssocTypeAndDestClass(ATTRIBUTE_ASSOC, destClassId);
	}
	public Cell getObjectByAssocTypeAndDestClass(long assocType, Cell destClass){
		return getObjectByAssocTypeAndDestClass(assocType, destClass==null?0:destClass.getId());
	}
	public Cell getObjectByAssocTypeAndDestClass(long assocType, long destClassId){
		//check to see if this assoc type is a one type
		if(assocType==PARENT_ASSOC || assocType==ATTRIBUTE_ASSOC || assocType==MAPSTO_ASSOC || assocType==DEFAULT_ASSOC || assocType==ONETOONE_ASSOC || assocType==NEXT_ASSOC || assocType==ORDERED_PARENT_PASSOC || assocType==MANYTOONE_PASSOC){
			LinkedList<Cell> list = getListOfRelatedObjectsByAssocTypeAndDestClassId(assocType, destClassId);
			if(destClassId!=0 && list.size()>1) {
				System.out.println("ERROR:\tA 'to one' association has more than one destination");
				//System.out.println("source:\t"+this.getIdName(50));
				System.out.println("source:\t"+this.getId()+" - "+this.getName());
				System.out.println("assocType:\t"+assocType);
				System.out.println("list:\t"+listToString(list));
				throw new RuntimeException("A 'to one' association has more than one destination");
			}
			if(list.isEmpty()) return null;
			return list.getFirst();
		}
		else {
			System.out.println("ERROR:\tassocType must be a 'to one' type");
			//System.out.println("source:\t"+this.getIdName(50));
			System.out.println("source:\t"+this.getId()+" - "+this.getName());
			System.out.println("assocType:\t"+assocType);
			throw new RuntimeException("assocType must be a 'to one' type");
		}
	}
	private void addNextToListByDestClass(LinkedList<Cell> list, long destClassId){
		Cell nextObj = getObjectByAssocTypeAndDestClass(NEXT_ASSOC, destClassId);
		if(nextObj==null) return; 
		if(list.contains(nextObj)){
			System.out.println("ERROR:\tCircular reference in next list");
			System.out.println("source:\t"+this.getIdName(50));
			System.out.println("list:\t"+listToString(list));
			throw new RuntimeException("Circular reference in next list");
		} 
		list.add(nextObj);
		nextObj.addNextToListByDestClass(list, destClassId);
	}

	public Cell xxxfindFirstReverse(Cell destClass){
		// see if this one has a parent
		for(Iterator<Assoc> itr=getDestAssocs().iterator();itr.hasNext();){
			Assoc a = ((Assoc)itr.next());
			if(a.getType() == ORDERED_ASSOC && (destClass==null || a.getDestFk().isA(destClass))){//found it
				return a.getSourceFk();
			}
		}
		for(Iterator<Assoc> itr=getDestAssocs().iterator();itr.hasNext();){
			Assoc a = ((Assoc)itr.next());
			if(a.getType() == NEXT_ASSOC){
				Cell prev = a.getSourceFk();
				return prev.xxxfindFirstReverse(destClass);//assume only one TODO posibly not right
			}
		}
		//could not find it
		return null;
	}
	public Cell findFirstReverse(long destClassId){
		// see if this one has a parent
		for(Iterator<Assoc> itr=getDestAssocs().iterator();itr.hasNext();){
			Assoc a = ((Assoc)itr.next());
			if(a.getType() == ORDERED_ASSOC && (destClassId==0 || a.getDestFk().isA(destClassId))){//found it
				return a.getSourceFk();
			}
		}
		for(Iterator<Assoc> itr=getDestAssocs().iterator();itr.hasNext();){
			Assoc a = ((Assoc)itr.next());
			if(a.getType() == NEXT_ASSOC){
				Cell prev = a.getSourceFk();
				return prev.findFirstReverse(destClassId);//assume only one TODO posibly not right
			}
		}
		//could not find it
		return null;
	}

	public Cell getClassAttributeOfType(long soughtType){
		for(Iterator<Assoc> itr3=getSourceAssocs().iterator();itr3.hasNext();){
			Assoc a = ((Assoc)itr3.next());
			if(a.getType() == 439){//Class Attribute
				if(a.getDestFk().isA(soughtType)) return a.getDestFk();
			}
		}
		return null;
	}


	public void positionCells3D(Element sceneEl, Map cellPos, Vector3d ourPos){
		if(cellPos.containsKey(this)) return;
		positionCells3DUp(sceneEl, cellPos, ourPos);
		Vector3d usePos1 = new Vector3d(ourPos);
		Vector3d usePos2 = new Vector3d(ourPos);
		usePos1.x -= 16;
		Iterator<Assoc> parentIter = getDestAssocs().iterator();
		while(parentIter.hasNext()){
			Assoc parentAssoc = (Assoc)parentIter.next();
			//System.out.println(name+ " - "+ p.getName()+ " - "+ cellA.getType());

			if(parentAssoc.getType() != PARENT_ASSOC){
				parentAssoc.getSourceFk().positionCells3DUp(sceneEl, cellPos, usePos1);
				usePos1.z -= 8;
			}
		}
		usePos2.x += 16;
		parentIter = getSourceAssocs().iterator();
		while (parentIter.hasNext()){
			Assoc parentAssoc = (Assoc)parentIter.next();
			//System.out.println(name+ " - "+ p.getName()+ " - "+ cellA.getType());

			if(parentAssoc.getType() != PARENT_ASSOC){
				parentAssoc.getDestFk().positionCells3DUp(sceneEl, cellPos, usePos2);
				usePos2.z -= 8;
			}
		}
	}
	public void positionCells3DUp(Element sceneEl, Map cellPos, Vector3d ourPos){
		if(cellPos.containsKey(this)) return;
		cellPos.put(this, new Vector3d(ourPos));
		Vector3d usePos = new Vector3d(ourPos);
		usePos.y += 8;
		Iterator<Assoc> parentIter = getSourceAssocs().iterator();
		while (parentIter.hasNext()){
			Assoc parentAssoc = (Assoc)parentIter.next();
			if(parentAssoc.getType() == PARENT_ASSOC){
				parentAssoc.getDestFk().positionCells3DUp(sceneEl, cellPos, usePos);
				usePos.z -= -8;
			}
		}
	}

	public int[] positionCells2D(Map cellPos, int[] ourPos){
		int[] noPos = {0,0};
		if(cellPos.containsKey(this)) return noPos;
		if(getType() == OBJECT) return noPos;
		//System.out.println(getName()+ " - "+ ourPos[0]+","+ourPos[1]);
		int[] copyPos = {ourPos[0],ourPos[1]};
		cellPos.put(this, copyPos);
		//System.out.println(">name - "+ getName()+ " - "+ ourPos[0]+","+ourPos[1]);
		int[]  usePos = {ourPos[0],ourPos[1]};
		int[]  maxPos = {ourPos[0],ourPos[1]};
		usePos[1] += SVGGRIDHEIGHT;
		Iterator<Assoc> childIter = getDestAssocs().iterator();
		while (childIter.hasNext()){
			Assoc childAssoc = (Assoc)childIter.next();
			if(childAssoc.getType() == PARENT_ASSOC){
				//System.out.println("name - "+ childAssoc.getSourceFk().getName()+ " - "+ childAssoc.getType());
				int[] retPos = childAssoc.getSourceFk().positionCells2D(cellPos, usePos);
				maxPos = vectorMax(retPos, maxPos);
				if(!(retPos[0]==0 && retPos[1]==0)) usePos[0] = maxPos[0] + SVGGRIDWIDTH;
			}
		}
		//doesn't work
		//ourPos[0] = ourPos[0]+(maxPos[0]-ourPos[0])/2;//move our cell to the center of the underlying childern
		//cellPos.put(this, copyPos);
		//int[] usePos2 = {maxPos[0]+SVGGRIDWIDTH,ourPos[1]};
		usePos[0] = maxPos[0]+SVGGRIDWIDTH;
		usePos[1] = ourPos[1];
		Iterator<Assoc> oneManyIter = getSourceAssocs().iterator();
		while (oneManyIter.hasNext()){
			Assoc manyAssoc = (Assoc)oneManyIter.next();
			if(manyAssoc.getType() == ORDERED_ASSOC ||
					manyAssoc.getType() == MANYTOMANY_ASSOC||
					manyAssoc.getType() == ONETOMANY_ASSOC||
					manyAssoc.getType() == MAPSTO_ASSOC){//one to many
				//System.out.println("name - "+ manyAssoc.getDestFk().getName()+ " - "+ manyAssoc.getType());
				int[] retPos = manyAssoc.getDestFk().positionCells2D(cellPos, usePos);
				maxPos = vectorMax(retPos, maxPos);
				if(!(retPos[0]==0 && retPos[1]==0))  usePos[0] = maxPos[0] + SVGGRIDWIDTH;//usePos[1] = maxPos[1] + SVGGRIDHEIGHT;
			}
		}
		Iterator<Assoc> manyOneIter = getDestAssocs().iterator();
		while (manyOneIter.hasNext()){
			Assoc manyAssoc = (Assoc)manyOneIter.next();
			if(manyAssoc.getType() == ORDERED_ASSOC ||
					manyAssoc.getType() == MANYTOMANY_ASSOC||
					manyAssoc.getType() == ONETOMANY_ASSOC||
					manyAssoc.getType() == MAPSTO_ASSOC){//one to many
				//System.out.println("name - "+ manyAssoc.getDestFk().getName()+ " - "+ manyAssoc.getType());
				int[] retPos = manyAssoc.getSourceFk().positionCells2D(cellPos, usePos);
				maxPos = vectorMax(retPos, maxPos);
				if(!(retPos[0]==0 && retPos[1]==0))  usePos[0] = maxPos[0] + SVGGRIDWIDTH;//usePos[1] = maxPos[1] + SVGGRIDHEIGHT;
			}
		}
		/*Iterator<Assoc> oneIter = getDestAssocs().iterator();
		while (oneIter.hasNext()){
			Assoc oneAssoc = (Assoc)oneIter.next();
			if(oneAssoc.getType() == ORDERED_ASSOC){
				Vector2d retPos = oneAssoc.getSourceFk().positionCells2D(cellPos, usePos);
				maxPos = vectorMax(retPos, maxPos);
				usePos[1] = maxPos[1] + SVGGRIDHEIGHT;
			}
		}*/
		return maxPos;
	}
	public int[] vectorMax(int[] a, int[] b){
		int[] retVec = {a[0],a[1]};
		if(b[0]>a[0]) retVec[0] = b[0]; 
		if(b[1]>a[1]) retVec[1] = b[1];
		return retVec;
	}
	private String listToString(LinkedList<Cell> list){
		String retString = "";
		for(Iterator<Cell> itr1=list.iterator();itr1.hasNext();){
			Cell cell = itr1.next();
			retString += "; "+cell.getIdName(50);
		}
		return retString;
	}


}